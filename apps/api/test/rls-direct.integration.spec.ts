import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  HouseholdMembershipStatus,
  HouseholdRole,
  UserStatus,
} from '../src/generated/prisma/client';
import type { PrismaService } from '../src/persistence/prisma/prisma.service';
import { PrismaService as ConcretePrismaService } from '../src/persistence/prisma/prisma.service';
import {
  RLS_SPIKE_APP_ROLE,
  RLS_SPIKE_OWNER_ROLE,
  backendPid,
  createRlsProbeClient,
  databaseUrlForRole,
  installRlsSpike,
  removeRlsSpike,
  rlsSpikeAdminDatabaseUrl,
  rlsInstallationIssues,
  withJobHouseholdContext,
  withRlsContext,
  type RlsContext,
  type RlsProbeClient,
} from './rls/rls-spike-harness';
import { cleanStoryOneTables } from './database-test-utils';

interface Fixture {
  householdAId: string;
  householdBId: string;
  membershipAId: string;
  membershipBId: string;
  userAId: string;
  userBId: string;
}

async function createFixture(admin: PrismaService): Promise<Fixture> {
  const userA = await admin.user.create({ data: {} });
  const userB = await admin.user.create({ data: {} });
  const householdA = await admin.household.create({ data: { name: 'RLS probe household A' } });
  const householdB = await admin.household.create({ data: { name: 'RLS probe household B' } });
  const membershipA = await admin.householdMembership.create({
    data: {
      householdId: householdA.id,
      role: HouseholdRole.Owner,
      status: HouseholdMembershipStatus.Active,
      userId: userA.id,
    },
  });
  const membershipB = await admin.householdMembership.create({
    data: {
      householdId: householdB.id,
      role: HouseholdRole.Owner,
      status: HouseholdMembershipStatus.Active,
      userId: userB.id,
    },
  });

  return {
    householdAId: householdA.id,
    householdBId: householdB.id,
    membershipAId: membershipA.id,
    membershipBId: membershipB.id,
    userAId: userA.id,
    userBId: userB.id,
  };
}

describe.sequential('pre-Phase 3 PostgreSQL RLS spike with direct pg pooling', () => {
  let admin: PrismaService;
  let app: RlsProbeClient;
  let job: RlsProbeClient;
  let appDatabaseUrl: string;
  let fixture: Fixture;

  const contextA = (): RlsContext => ({
    actorUserId: fixture.userAId,
    householdId: fixture.householdAId,
  });
  const contextB = (): RlsContext => ({
    actorUserId: fixture.userBId,
    householdId: fixture.householdBId,
  });

  beforeAll(async () => {
    const adminDatabaseUrl = rlsSpikeAdminDatabaseUrl();
    admin = new ConcretePrismaService(adminDatabaseUrl);
    await admin.$connect();
    await removeRlsSpike(admin);
    await cleanStoryOneTables(admin);

    const appPassword = process.env.RLS_SPIKE_APP_PASSWORD;
    const jobPassword = process.env.RLS_SPIKE_JOB_PASSWORD;
    if (appPassword === undefined || jobPassword === undefined) {
      throw new Error('RLS spike role passwords are required.');
    }
    const passwords = await installRlsSpike(admin, {
      appPassword,
      jobPassword,
    });
    appDatabaseUrl = databaseUrlForRole(
      adminDatabaseUrl,
      RLS_SPIKE_APP_ROLE,
      passwords.appPassword,
    );
    app = createRlsProbeClient(appDatabaseUrl, 2);
    job = createRlsProbeClient(
      databaseUrlForRole(adminDatabaseUrl, 'rls_spike_job', passwords.jobPassword),
      1,
    );
    await app.$connect();
    await job.$connect();
    fixture = await createFixture(admin);
  });

  beforeEach(async () => {
    await admin.$executeRawUnsafe('DELETE FROM rls_spike.probe_item');
    await admin.$executeRawUnsafe('DELETE FROM rls_spike.probe_resource');
    await admin.user.updateMany({ data: { status: UserStatus.Active } });
    await admin.householdMembership.updateMany({
      data: { status: HouseholdMembershipStatus.Active },
    });
  });

  afterAll(async () => {
    await app?.$disconnect();
    await job?.$disconnect();
    if (admin !== undefined) {
      await removeRlsSpike(admin);
      await cleanStoryOneTables(admin);
      await admin.$disconnect();
    }
  });

  it('installs exact RLS metadata, least-privilege roles and a hardened membership function', async () => {
    await expect(rlsInstallationIssues(admin)).resolves.toEqual([]);

    const [identity] = await app.$queryRaw<Array<{ currentUser: string; sessionUser: string }>>`
      SELECT current_user::text AS "currentUser", session_user::text AS "sessionUser"
    `;
    expect(identity).toEqual({
      currentUser: RLS_SPIKE_APP_ROLE,
      sessionUser: RLS_SPIKE_APP_ROLE,
    });

    const [version] = await admin.$queryRaw<Array<{ serverVersion: string }>>`
      SELECT pg_catalog.current_setting('server_version') AS "serverVersion"
    `;
    expect(version?.serverVersion).toBeTruthy();
  });

  it('fails closed with absent, partial or malformed transaction context', async () => {
    await expect(app.probeResource.findMany()).resolves.toEqual([]);
    await expect(
      app.probeResource.create({
        data: {
          clientKey: 'missing-context',
          householdId: fixture.householdAId,
          label: 'must fail',
        },
      }),
    ).rejects.toBeDefined();

    const partialResult = await app.$transaction(async (transaction) => {
      await transaction.$queryRaw`
        SELECT pg_catalog.set_config('app.actor_user_id', ${fixture.userAId}, true)
      `;
      return transaction.probeResource.findMany();
    });
    expect(partialResult).toEqual([]);

    await expect(
      withRlsContext(
        app,
        { actorUserId: 'not-a-uuid', householdId: fixture.householdAId },
        { intent: 'read' },
        async () => undefined,
      ),
    ).rejects.toThrow(/actorUserId must be a valid UUID/u);

    await expect(
      app.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT
            pg_catalog.set_config('app.actor_user_id', ${fixture.userAId}, true),
            pg_catalog.set_config('app.household_id', ${'malformed'}, true)
        `;
        return transaction.probeResource.findMany();
      }),
    ).rejects.toBeDefined();
  });

  it('isolates CRUD by Household and enforces USING plus WITH CHECK', async () => {
    const resourceA = await withRlsContext(app, contextA(), { intent: 'write' }, (transaction) =>
      transaction.probeResource.create({
        data: {
          clientKey: 'resource-a',
          householdId: fixture.householdAId,
          items: {
            create: { payload: 'item-a' },
          },
          label: 'visible only in A',
        },
        include: { items: true },
      }),
    );
    expect(resourceA.items).toHaveLength(1);

    await expect(
      withRlsContext(app, contextB(), { intent: 'read' }, (transaction) =>
        transaction.probeResource.findMany({ include: { items: true } }),
      ),
    ).resolves.toEqual([]);
    await expect(
      withRlsContext(app, contextB(), { intent: 'write' }, (transaction) =>
        transaction.probeResource.updateMany({
          data: { label: 'cross-household update' },
          where: { id: resourceA.id },
        }),
      ),
    ).resolves.toEqual({ count: 0 });
    await expect(
      withRlsContext(app, contextB(), { intent: 'write' }, (transaction) =>
        transaction.probeResource.deleteMany({ where: { id: resourceA.id } }),
      ),
    ).resolves.toEqual({ count: 0 });
    await expect(
      withRlsContext(app, contextA(), { intent: 'write' }, (transaction) =>
        transaction.probeResource.create({
          data: {
            clientKey: 'wrong-household',
            householdId: fixture.householdBId,
            label: 'must fail WITH CHECK',
          },
        }),
      ),
    ).rejects.toBeDefined();
    await expect(
      withRlsContext(app, contextA(), { intent: 'write' }, (transaction) =>
        transaction.probeResource.update({
          data: { householdId: fixture.householdBId },
          where: { id: resourceA.id },
        }),
      ),
    ).rejects.toBeDefined();

    await expect(
      withRlsContext(app, contextA(), { intent: 'write' }, async (transaction) => {
        await transaction.probeItem.deleteMany({
          where: { householdId: fixture.householdAId, resourceId: resourceA.id },
        });
        return transaction.probeResource.delete({ where: { id: resourceA.id } });
      }),
    ).resolves.toMatchObject({ id: resourceA.id });
  });

  it('revokes access when membership or User status stops being active', async () => {
    await withRlsContext(app, contextA(), { intent: 'write' }, (transaction) =>
      transaction.probeResource.create({
        data: {
          clientKey: 'membership-status',
          householdId: fixture.householdAId,
          label: 'status protected',
        },
      }),
    );

    for (const status of [
      HouseholdMembershipStatus.Suspended,
      HouseholdMembershipStatus.Left,
      HouseholdMembershipStatus.Removed,
    ]) {
      await admin.householdMembership.update({
        data: { status },
        where: { id: fixture.membershipAId },
      });
      await expect(
        withRlsContext(app, contextA(), { intent: 'read' }, (transaction) =>
          transaction.probeResource.findMany(),
        ),
      ).resolves.toEqual([]);
    }

    await admin.householdMembership.update({
      data: { status: HouseholdMembershipStatus.Active },
      where: { id: fixture.membershipAId },
    });
    await admin.user.update({
      data: { status: UserStatus.Blocked },
      where: { id: fixture.userAId },
    });
    await expect(
      withRlsContext(app, contextA(), { intent: 'read' }, (transaction) =>
        transaction.probeResource.findMany(),
      ),
    ).resolves.toEqual([]);
  });

  it('rolls back a nested write and rejects a composite cross-Household relationship', async () => {
    await expect(
      withRlsContext(app, contextA(), { intent: 'write' }, (transaction) =>
        transaction.probeResource.create({
          data: {
            clientKey: 'nested-rollback',
            householdId: fixture.householdAId,
            items: {
              create: { payload: '__force_rollback__' },
            },
            label: 'must roll back',
          },
        }),
      ),
    ).rejects.toBeDefined();
    await expect(
      admin.$queryRaw<Array<{ count: bigint }>>`
        SELECT pg_catalog.count(*) AS count
          FROM rls_spike.probe_resource
         WHERE client_key = 'nested-rollback'
      `,
    ).resolves.toEqual([{ count: 0n }]);

    const resource = await withRlsContext(app, contextA(), { intent: 'write' }, (transaction) =>
      transaction.probeResource.create({
        data: {
          clientKey: 'composite-fk',
          householdId: fixture.householdAId,
          label: 'parent A',
        },
      }),
    );
    await expect(
      admin.$executeRaw`
        INSERT INTO rls_spike.probe_item (id, resource_id, household_id, payload)
        VALUES (
          pg_catalog.gen_random_uuid(),
          ${resource.id}::uuid,
          ${fixture.householdBId}::uuid,
          'must fail composite FK'
        )
      `,
    ).rejects.toBeDefined();
  });

  it('demonstrates the global-unique side channel and the Household-scoped alternative', async () => {
    await withRlsContext(app, contextA(), { intent: 'write' }, (transaction) =>
      transaction.probeResource.create({
        data: {
          clientKey: 'safe-local-key',
          globalKey: 'hidden-global-key',
          householdId: fixture.householdAId,
          label: 'A',
        },
      }),
    );

    await expect(
      withRlsContext(app, contextB(), { intent: 'write' }, (transaction) =>
        transaction.probeResource.create({
          data: {
            clientKey: 'safe-local-key',
            householdId: fixture.householdBId,
            label: 'B with same household-local key',
          },
        }),
      ),
    ).resolves.toMatchObject({ householdId: fixture.householdBId });
    await expect(
      withRlsContext(app, contextB(), { intent: 'write' }, (transaction) =>
        transaction.probeResource.create({
          data: {
            clientKey: 'another-local-key',
            globalKey: 'hidden-global-key',
            householdId: fixture.householdBId,
            label: 'reveals hidden collision',
          },
        }),
      ),
    ).rejects.toBeDefined();
  });

  it('does not leak transaction-local context when one direct pool connection is reused', async () => {
    const singleConnectionApp = createRlsProbeClient(appDatabaseUrl, 1);
    await singleConnectionApp.$connect();

    try {
      const pidA = await withRlsContext(
        singleConnectionApp,
        contextA(),
        { intent: 'write' },
        async (transaction, pid) => {
          await transaction.probeResource.create({
            data: {
              clientKey: 'pool-a',
              householdId: fixture.householdAId,
              label: 'A',
            },
          });
          return pid;
        },
      );
      const noContext = await singleConnectionApp.$transaction(async (transaction) => {
        const [settings] = await transaction.$queryRaw<
          Array<{ actor: string | null; household: string | null }>
        >`
          SELECT
            NULLIF(pg_catalog.current_setting('app.actor_user_id', true), '') AS actor,
            NULLIF(pg_catalog.current_setting('app.household_id', true), '') AS household
        `;
        return {
          pid: await backendPid(transaction),
          rows: await transaction.probeResource.findMany(),
          settings,
        };
      });
      const pidB = await withRlsContext(
        singleConnectionApp,
        contextB(),
        { intent: 'write' },
        async (transaction, pid) => {
          await transaction.probeResource.create({
            data: {
              clientKey: 'pool-b',
              householdId: fixture.householdBId,
              label: 'B',
            },
          });
          return pid;
        },
      );

      expect(noContext.pid).toBe(pidA);
      expect(pidB).toBe(pidA);
      expect(noContext.settings).toEqual({ actor: null, household: null });
      expect(noContext.rows).toEqual([]);
    } finally {
      await singleConnectionApp.$disconnect();
    }
  });

  it('keeps concurrent contexts isolated on a two-connection direct pool', async () => {
    await withRlsContext(app, contextA(), { intent: 'write' }, (transaction) =>
      transaction.probeResource.create({
        data: { clientKey: 'concurrent-a', householdId: fixture.householdAId, label: 'A' },
      }),
    );
    await withRlsContext(app, contextB(), { intent: 'write' }, (transaction) =>
      transaction.probeResource.create({
        data: { clientKey: 'concurrent-b', householdId: fixture.householdBId, label: 'B' },
      }),
    );

    let arrivals = 0;
    let release!: () => void;
    const bothStarted = new Promise<void>((resolve) => {
      release = resolve;
    });
    const readContext = (context: RlsContext) =>
      withRlsContext(app, context, { intent: 'read' }, async (transaction, pid) => {
        arrivals += 1;
        if (arrivals === 2) release();
        await bothStarted;
        return { pid, rows: await transaction.probeResource.findMany() };
      });

    const [resultA, resultB] = await Promise.all([
      readContext(contextA()),
      readContext(contextB()),
    ]);
    expect(resultA.pid).not.toBe(resultB.pid);
    expect(resultA.rows.map(({ householdId }) => householdId)).toEqual([fixture.householdAId]);
    expect(resultB.rows.map(({ householdId }) => householdId)).toEqual([fixture.householdBId]);
  });

  it('keeps owner subject to FORCE RLS, scopes jobs, and exposes admin bypass as a negative control', async () => {
    await withRlsContext(app, contextA(), { intent: 'write' }, (transaction) =>
      transaction.probeResource.create({
        data: { clientKey: 'role-a', householdId: fixture.householdAId, label: 'A' },
      }),
    );
    await withRlsContext(app, contextB(), { intent: 'write' }, (transaction) =>
      transaction.probeResource.create({
        data: { clientKey: 'role-b', householdId: fixture.householdBId, label: 'B' },
      }),
    );

    const ownerCount = await admin.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`SET LOCAL ROLE ${RLS_SPIKE_OWNER_ROLE}`);
      const [row] = await transaction.$queryRawUnsafe<Array<{ count: bigint }>>(
        'SELECT pg_catalog.count(*) AS count FROM rls_spike.probe_resource',
      );
      return row?.count;
    });
    expect(ownerCount).toBe(0n);

    await expect(job.probeResource.findMany()).resolves.toEqual([]);
    await expect(
      withJobHouseholdContext(job, fixture.householdAId, (transaction) =>
        transaction.probeResource.findMany(),
      ),
    ).resolves.toEqual([expect.objectContaining({ householdId: fixture.householdAId })]);

    await expect(
      admin.$queryRaw<Array<{ count: bigint }>>`
        SELECT pg_catalog.count(*) AS count FROM rls_spike.probe_resource
      `,
    ).resolves.toEqual([{ count: 2n }]);
  });

  it('detects disabled, missing and overbroad policies instead of trusting behavioral happy paths', async () => {
    const rollback = new Error('ROLLBACK_RLS_MUTATION');

    await expect(
      admin.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(
          'ALTER TABLE rls_spike.probe_resource DISABLE ROW LEVEL SECURITY',
        );
        expect(await rlsInstallationIssues(transaction)).toContain(
          'probe_resource does not enable RLS',
        );
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    await expect(
      admin.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(
          'DROP POLICY probe_resource_app_policy ON rls_spike.probe_resource',
        );
        expect(await rlsInstallationIssues(transaction)).toContain(
          'missing policy probe_resource_app_policy',
        );
        await transaction.$executeRawUnsafe(`SET LOCAL ROLE ${RLS_SPIKE_APP_ROLE}`);
        const [row] = await transaction.$queryRawUnsafe<Array<{ count: bigint }>>(
          'SELECT pg_catalog.count(*) AS count FROM rls_spike.probe_resource',
        );
        expect(row?.count).toBe(0n);
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    await expect(
      admin.$transaction(async (transaction) => {
        await transaction.$executeRawUnsafe(
          'ALTER POLICY probe_resource_app_policy ON rls_spike.probe_resource USING (true) WITH CHECK (true)',
        );
        expect(await rlsInstallationIssues(transaction)).toContain(
          'probe_resource_app_policy lacks household USING scope',
        );
        throw rollback;
      }),
    ).rejects.toBe(rollback);

    await expect(rlsInstallationIssues(admin)).resolves.toEqual([]);
  });

  it('uses the Household-leading index in a representative RLS query plan', async () => {
    await admin.$executeRaw`
      INSERT INTO rls_spike.probe_resource (household_id, client_key, label)
      SELECT ${fixture.householdAId}::uuid, 'perf-a-' || series::text, 'A'
        FROM pg_catalog.generate_series(1, 3000) AS series
    `;
    await admin.$executeRaw`
      INSERT INTO rls_spike.probe_resource (household_id, client_key, label)
      SELECT ${fixture.householdBId}::uuid, 'perf-b-' || series::text, 'B'
        FROM pg_catalog.generate_series(1, 3000) AS series
    `;
    await admin.$executeRawUnsafe('ANALYZE rls_spike.probe_resource');

    const plan = await withRlsContext(app, contextA(), { intent: 'read' }, (transaction) =>
      transaction.$queryRawUnsafe<Array<{ 'QUERY PLAN': unknown }>>(
        "EXPLAIN (FORMAT JSON) SELECT * FROM rls_spike.probe_resource WHERE client_key = 'perf-a-1500'",
      ),
    );
    expect(JSON.stringify(plan)).toContain('uq_probe_resource_household_client_key');
  });

  it('keeps fixture identities opaque and distinct', () => {
    expect(fixture.userAId).not.toBe(fixture.userBId);
    expect(fixture.householdAId).not.toBe(fixture.householdBId);
    expect(fixture.membershipAId).not.toBe(fixture.membershipBId);
  });
});
