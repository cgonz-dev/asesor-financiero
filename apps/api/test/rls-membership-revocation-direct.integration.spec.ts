import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { HouseholdMembershipStatus, HouseholdRole } from '../src/generated/prisma/client';
import { PrismaService } from '../src/persistence/prisma/prisma.service';
import {
  RLS_ISOLATION_LEVEL,
  RLS_SPIKE_APP_ROLE,
  createRlsProbeClient,
  databaseUrlForRole,
  installRlsSpike,
  removeRlsSpike,
  rlsSpikeAdminDatabaseUrl,
  withRlsContext,
  withUnlockedRlsContextForControl,
  type RlsProbeClient,
} from './rls/rls-spike-harness';
import { cleanStoryOneTables } from './database-test-utils';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

interface WaitState {
  pid: number;
  waitEvent: string | null;
  waitEventType: string | null;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

async function waitForBackendWait(
  admin: PrismaService,
  filter: { pid?: number; role?: string },
  waitEventType = 'Lock',
): Promise<WaitState> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const rows = await admin.$queryRaw<Array<WaitState>>`
      SELECT
        pid::integer AS pid,
        wait_event::text AS "waitEvent",
        wait_event_type::text AS "waitEventType"
      FROM pg_catalog.pg_stat_activity
      WHERE state = 'active'
        AND (${filter.pid ?? null}::integer IS NULL OR pid = ${filter.pid ?? null}::integer)
        AND (${filter.role ?? null}::text IS NULL OR usename = ${filter.role ?? null}::text)
        AND wait_event_type = ${waitEventType}
      ORDER BY pid
    `;
    if (rows[0] !== undefined) return rows[0];
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }

  throw new Error(`Timed out waiting for PostgreSQL ${waitEventType} wait.`);
}

const REVOKED_STATUSES = [
  HouseholdMembershipStatus.Suspended,
  HouseholdMembershipStatus.Left,
  HouseholdMembershipStatus.Removed,
] as const;

describe.sequential('RLS membership revocation under direct PostgreSQL pooling', () => {
  let admin: PrismaService;
  let app: RlsProbeClient;
  let context: { actorUserId: string; householdId: string };
  let membershipId: string;
  let resourceId: string;

  beforeAll(async () => {
    const adminDatabaseUrl = rlsSpikeAdminDatabaseUrl();
    const appPassword = process.env.RLS_SPIKE_APP_PASSWORD;
    const jobPassword = process.env.RLS_SPIKE_JOB_PASSWORD;
    if (appPassword === undefined || jobPassword === undefined) {
      throw new Error('RLS spike role passwords are required.');
    }

    admin = new PrismaService(adminDatabaseUrl);
    await admin.$connect();
    await removeRlsSpike(admin);
    await cleanStoryOneTables(admin);
    const passwords = await installRlsSpike(admin, { appPassword, jobPassword });
    app = createRlsProbeClient(
      databaseUrlForRole(adminDatabaseUrl, RLS_SPIKE_APP_ROLE, passwords.appPassword),
      3,
    );
    await app.$connect();

    const user = await admin.user.create({ data: {} });
    const household = await admin.household.create({
      data: { name: 'Revocation probe household' },
    });
    const membership = await admin.householdMembership.create({
      data: {
        householdId: household.id,
        role: HouseholdRole.Owner,
        status: HouseholdMembershipStatus.Active,
        userId: user.id,
      },
    });
    context = { actorUserId: user.id, householdId: household.id };
    membershipId = membership.id;
  });

  beforeEach(async () => {
    await admin.$executeRawUnsafe('DELETE FROM rls_spike.probe_item');
    await admin.$executeRawUnsafe('DELETE FROM rls_spike.probe_resource');
    await admin.householdMembership.update({
      data: { status: HouseholdMembershipStatus.Active },
      where: { id: membershipId },
    });
    const [resource] = await admin.$queryRaw<Array<{ id: string }>>`
      INSERT INTO rls_spike.probe_resource (household_id, client_key, label)
      VALUES (${context.householdId}::uuid, 'revocation-target', 'before revocation')
      RETURNING id::text AS id
    `;
    if (resource === undefined) throw new Error('Failed to seed the RLS revocation resource.');
    resourceId = resource.id;
  });

  afterAll(async () => {
    await app?.$disconnect();
    if (admin !== undefined) {
      await removeRlsSpike(admin);
      await cleanStoryOneTables(admin);
      await admin.$disconnect();
    }
  });

  it.each(REVOKED_STATUSES)(
    're-evaluates the membership on the next READ COMMITTED statement after %s commits',
    async (status) => {
      const firstStatementCompleted = deferred<void>();
      const continueTransaction = deferred<void>();

      const read = withRlsContext(
        app,
        context,
        { intent: 'read', isolationLevel: RLS_ISOLATION_LEVEL.ReadCommitted },
        async (transaction) => {
          const [isolation] = await transaction.$queryRaw<Array<{ isolation: string }>>`
            SELECT pg_catalog.current_setting('transaction_isolation') AS isolation
          `;
          const before = await transaction.probeResource.findMany({ where: { id: resourceId } });
          firstStatementCompleted.resolve(undefined);
          await continueTransaction.promise;
          const after = await transaction.probeResource.findMany({ where: { id: resourceId } });
          return { after, before, isolation: isolation?.isolation };
        },
      );

      await firstStatementCompleted.promise;
      await admin.householdMembership.update({ data: { status }, where: { id: membershipId } });
      continueTransaction.resolve(undefined);

      await expect(read).resolves.toEqual({
        after: [],
        before: [expect.objectContaining({ id: resourceId })],
        isolation: 'read committed',
      });
      await expect(
        withRlsContext(app, context, { intent: 'read' }, (transaction) =>
          transaction.probeResource.findMany({ where: { id: resourceId } }),
        ),
      ).resolves.toEqual([]);
      await expect(
        withUnlockedRlsContextForControl(
          app,
          context,
          RLS_ISOLATION_LEVEL.ReadCommitted,
          (transaction) =>
            transaction.probeResource.updateMany({
              data: { label: 'must not update' },
              where: { id: resourceId },
            }),
        ),
      ).resolves.toEqual({ count: 0 });
      await expect(
        withUnlockedRlsContextForControl(
          app,
          context,
          RLS_ISOLATION_LEVEL.ReadCommitted,
          (transaction) => transaction.probeResource.deleteMany({ where: { id: resourceId } }),
        ),
      ).resolves.toEqual({ count: 0 });
      await expect(
        withUnlockedRlsContextForControl(
          app,
          context,
          RLS_ISOLATION_LEVEL.ReadCommitted,
          (transaction) =>
            transaction.probeResource.create({
              data: {
                clientKey: `denied-after-${status}`,
                householdId: context.householdId,
                label: 'must not insert',
              },
            }),
        ),
      ).rejects.toBeDefined();
    },
  );

  it('enforces read intent at the PostgreSQL transaction boundary', async () => {
    await expect(
      withRlsContext(app, context, { intent: 'read' }, async (transaction) => {
        const [settings] = await transaction.$queryRaw<
          Array<{ isolation: string; readOnly: string }>
        >`
          SELECT
            pg_catalog.current_setting('transaction_isolation') AS isolation,
            pg_catalog.current_setting('transaction_read_only') AS "readOnly"
        `;
        expect(settings).toEqual({ isolation: 'read committed', readOnly: 'on' });
        await transaction.probeResource.create({
          data: {
            clientKey: 'read-intent-write',
            householdId: context.householdId,
            label: 'must fail',
          },
        });
      }),
    ).rejects.toBeDefined();
  });

  it('rolls back partial work when an unlocked control transaction loses membership between statements', async () => {
    const firstWriteCompleted = deferred<void>();
    const continueTransaction = deferred<void>();

    const operation = withUnlockedRlsContextForControl(
      app,
      context,
      RLS_ISOLATION_LEVEL.ReadCommitted,
      async (transaction) => {
        await transaction.probeResource.create({
          data: {
            clientKey: 'partial-before-revocation',
            householdId: context.householdId,
            label: 'must roll back',
          },
        });
        firstWriteCompleted.resolve(undefined);
        await continueTransaction.promise;
        await transaction.probeResource.create({
          data: {
            clientKey: 'after-revocation',
            householdId: context.householdId,
            label: 'must be denied',
          },
        });
      },
    );

    await firstWriteCompleted.promise;
    await admin.householdMembership.update({
      data: { status: HouseholdMembershipStatus.Suspended },
      where: { id: membershipId },
    });
    continueTransaction.resolve(undefined);

    await expect(operation).rejects.toBeDefined();
    await expect(
      admin.$queryRaw<Array<{ count: bigint }>>`
        SELECT pg_catalog.count(*) AS count
        FROM rls_spike.probe_resource
        WHERE client_key IN ('partial-before-revocation', 'after-revocation')
      `,
    ).resolves.toEqual([{ count: 0n }]);
  });

  it('reproduces the documented stale-policy race inside one READ COMMITTED locking statement', async () => {
    const actorReady = deferred<number>();
    const startActorStatement = deferred<void>();
    const revocationPrepared = deferred<void>();
    const commitRevocation = deferred<void>();

    const actor = withUnlockedRlsContextForControl(
      app,
      context,
      RLS_ISOLATION_LEVEL.ReadCommitted,
      async (transaction, pid) => {
        const [authorization] = await transaction.$queryRaw<Array<{ active: boolean }>>`
          SELECT rls_spike.current_actor_is_active_member() AS active
        `;
        expect(authorization).toEqual({ active: true });
        actorReady.resolve(pid);
        await startActorStatement.promise;
        return transaction.$queryRaw<Array<{ id: string; label: string }>>`
          SELECT id::text AS id, label
          FROM rls_spike.probe_resource
          WHERE id = ${resourceId}::uuid
          FOR UPDATE
        `;
      },
    );
    const actorPid = await actorReady.promise;

    const revocation = admin.$transaction(
      async (transaction) => {
        await transaction.householdMembership.update({
          data: { status: HouseholdMembershipStatus.Suspended },
          where: { id: membershipId },
        });
        await transaction.$executeRaw`
          UPDATE rls_spike.probe_resource
          SET label = 'updated with revocation'
          WHERE id = ${resourceId}::uuid
        `;
        revocationPrepared.resolve(undefined);
        await commitRevocation.promise;
      },
      { timeout: 10_000 },
    );

    await revocationPrepared.promise;
    startActorStatement.resolve(undefined);
    await waitForBackendWait(admin, { pid: actorPid });
    commitRevocation.resolve(undefined);

    await expect(revocation).resolves.toBeUndefined();
    await expect(actor).resolves.toEqual([{ id: resourceId, label: 'updated with revocation' }]);
  });

  it.each([RLS_ISOLATION_LEVEL.RepeatableRead, RLS_ISOLATION_LEVEL.Serializable] as const)(
    '%s does not provide next-statement revocation semantics by itself',
    async (isolationLevel) => {
      const firstReadCompleted = deferred<void>();
      const continueTransaction = deferred<void>();

      const actor = withUnlockedRlsContextForControl(
        app,
        context,
        isolationLevel,
        async (transaction) => {
          const before = await transaction.probeResource.findMany({ where: { id: resourceId } });
          firstReadCompleted.resolve(undefined);
          await continueTransaction.promise;
          const after = await transaction.probeResource.findMany({ where: { id: resourceId } });
          return { after, before };
        },
      );

      await firstReadCompleted.promise;
      await admin.householdMembership.update({
        data: { status: HouseholdMembershipStatus.Suspended },
        where: { id: membershipId },
      });
      continueTransaction.resolve(undefined);

      await expect(actor).resolves.toEqual({
        after: [expect.objectContaining({ id: resourceId })],
        before: [expect.objectContaining({ id: resourceId })],
      });
    },
  );

  it.each(REVOKED_STATUSES)(
    'orders a locked write before a concurrent %s revocation',
    async (status) => {
      const writeLockAcquired = deferred<void>();
      const finishWrite = deferred<void>();
      const revokerPid = deferred<number>();
      const order: string[] = [];

      const operation = withRlsContext(app, context, { intent: 'write' }, async (transaction) => {
        writeLockAcquired.resolve(undefined);
        await finishWrite.promise;
        await transaction.probeResource.create({
          data: {
            clientKey: `locked-before-${status}`,
            householdId: context.householdId,
            label: 'ordered before revocation',
          },
        });
      }).then(() => order.push('operation'));

      await writeLockAcquired.promise;
      const revocation = admin
        .$transaction(
          async (transaction) => {
            const [pidRow] = await transaction.$queryRaw<Array<{ pid: number }>>`
              SELECT pg_catalog.pg_backend_pid()::integer AS pid
            `;
            if (pidRow === undefined) throw new Error('Missing revoker backend pid.');
            revokerPid.resolve(pidRow.pid);
            await transaction.householdMembership.update({
              data: { status },
              where: { id: membershipId },
            });
          },
          { timeout: 10_000 },
        )
        .then(() => order.push('revocation'));

      await waitForBackendWait(admin, { pid: await revokerPid.promise });
      finishWrite.resolve(undefined);
      await Promise.all([operation, revocation]);

      expect(order).toEqual(['operation', 'revocation']);
      await expect(
        admin.$queryRaw<Array<{ count: bigint }>>`
          SELECT pg_catalog.count(*) AS count
          FROM rls_spike.probe_resource
          WHERE client_key = ${`locked-before-${status}`}
        `,
      ).resolves.toEqual([{ count: 1n }]);
      await expect(
        withRlsContext(app, context, { intent: 'read' }, (transaction) =>
          transaction.probeResource.findMany(),
        ),
      ).resolves.toEqual([]);
    },
  );

  it('denies a locked write when the revocation owns the membership row first', async () => {
    const revocationPrepared = deferred<void>();
    const commitRevocation = deferred<void>();
    const revocation = admin.$transaction(
      async (transaction) => {
        await transaction.householdMembership.update({
          data: { status: HouseholdMembershipStatus.Removed },
          where: { id: membershipId },
        });
        revocationPrepared.resolve(undefined);
        await commitRevocation.promise;
      },
      { timeout: 10_000 },
    );
    await revocationPrepared.promise;

    const operationOutcome = withRlsContext(app, context, { intent: 'write' }, (transaction) =>
      transaction.probeResource.create({
        data: {
          clientKey: 'must-not-follow-revocation',
          householdId: context.householdId,
          label: 'must not commit',
        },
      }),
    ).then(
      () => ({ error: undefined, succeeded: true }),
      (error: unknown) => ({ error, succeeded: false }),
    );

    await waitForBackendWait(admin, { role: RLS_SPIKE_APP_ROLE });
    commitRevocation.resolve(undefined);
    await expect(revocation).resolves.toBeUndefined();
    const outcome = await operationOutcome;

    expect(outcome.succeeded).toBe(false);
    expect(String(outcome.error)).toContain('active membership required');
    await expect(
      admin.$queryRaw<Array<{ count: bigint }>>`
        SELECT pg_catalog.count(*) AS count
        FROM rls_spike.probe_resource
        WHERE client_key = 'must-not-follow-revocation'
      `,
    ).resolves.toEqual([{ count: 0n }]);
  });

  it('releases the membership lock on rollback so revocation can commit without partial data', async () => {
    const writeLockAcquired = deferred<void>();
    const rollBackWrite = deferred<void>();
    const revokerPid = deferred<number>();
    const rollback = new Error('ROLLBACK_LOCKED_WRITE');

    const operation = withRlsContext(app, context, { intent: 'write' }, async (transaction) => {
      await transaction.probeResource.create({
        data: {
          clientKey: 'rolled-back-locked-write',
          householdId: context.householdId,
          label: 'must roll back',
        },
      });
      writeLockAcquired.resolve(undefined);
      await rollBackWrite.promise;
      throw rollback;
    });

    await writeLockAcquired.promise;
    const revocation = admin.$transaction(
      async (transaction) => {
        const [pidRow] = await transaction.$queryRaw<Array<{ pid: number }>>`
          SELECT pg_catalog.pg_backend_pid()::integer AS pid
        `;
        if (pidRow === undefined) throw new Error('Missing revoker backend pid.');
        revokerPid.resolve(pidRow.pid);
        await transaction.householdMembership.update({
          data: { status: HouseholdMembershipStatus.Left },
          where: { id: membershipId },
        });
      },
      { timeout: 10_000 },
    );

    await waitForBackendWait(admin, { pid: await revokerPid.promise });
    rollBackWrite.resolve(undefined);
    await expect(operation).rejects.toBe(rollback);
    await expect(revocation).resolves.toBeUndefined();
    await expect(
      admin.$queryRaw<Array<{ count: bigint }>>`
        SELECT pg_catalog.count(*) AS count
        FROM rls_spike.probe_resource
        WHERE client_key = 'rolled-back-locked-write'
      `,
    ).resolves.toEqual([{ count: 0n }]);
  });

  it('releases the membership lock when Prisma times out the interactive transaction', async () => {
    const writeLockAcquired = deferred<void>();
    const revokerPid = deferred<number>();

    const operationOutcome = withRlsContext(
      app,
      context,
      { intent: 'write', timeoutMs: 200 },
      async (transaction) => {
        writeLockAcquired.resolve(undefined);
        await new Promise<void>((resolve) => setTimeout(resolve, 400));
        return transaction.probeResource.create({
          data: {
            clientKey: 'timed-out-locked-write',
            householdId: context.householdId,
            label: 'must not commit',
          },
        });
      },
    ).then(
      () => ({ error: undefined, succeeded: true }),
      (error: unknown) => ({ error, succeeded: false }),
    );

    await writeLockAcquired.promise;
    const revocation = admin.$transaction(
      async (transaction) => {
        const [pidRow] = await transaction.$queryRaw<Array<{ pid: number }>>`
          SELECT pg_catalog.pg_backend_pid()::integer AS pid
        `;
        if (pidRow === undefined) throw new Error('Missing timeout revoker backend pid.');
        revokerPid.resolve(pidRow.pid);
        await transaction.householdMembership.update({
          data: { status: HouseholdMembershipStatus.Suspended },
          where: { id: membershipId },
        });
      },
      { timeout: 10_000 },
    );

    await waitForBackendWait(admin, { pid: await revokerPid.promise });
    await expect(revocation).resolves.toBeUndefined();
    const outcome = await operationOutcome;
    expect(outcome.succeeded).toBe(false);
    await expect(
      admin.$queryRaw<Array<{ count: bigint }>>`
        SELECT pg_catalog.count(*) AS count
        FROM rls_spike.probe_resource
        WHERE client_key = 'timed-out-locked-write'
      `,
    ).resolves.toEqual([{ count: 0n }]);
  });
});
