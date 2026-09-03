import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { HouseholdMembershipStatus, HouseholdRole } from '../src/generated/prisma/client';
import { PrismaService } from '../src/persistence/prisma/prisma.service';
import {
  RLS_SPIKE_APP_ROLE,
  createRlsProbeClient,
  installRlsSpike,
  removeRlsSpike,
  rlsSpikeAdminDatabaseUrl,
  withRlsContext,
  type RlsProbeClient,
} from './rls/rls-spike-harness';
import { cleanStoryOneTables } from './database-test-utils';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

async function waitForLock(
  admin: PrismaService,
  filter: { pid?: number; role?: string },
): Promise<void> {
  const deadline = Date.now() + 5_000;

  while (Date.now() < deadline) {
    const rows = await admin.$queryRaw<Array<{ pid: number }>>`
      SELECT pid::integer AS pid
      FROM pg_catalog.pg_stat_activity
      WHERE state = 'active'
        AND (${filter.pid ?? null}::integer IS NULL OR pid = ${filter.pid ?? null}::integer)
        AND (${filter.role ?? null}::text IS NULL OR usename = ${filter.role ?? null}::text)
        AND wait_event_type = 'Lock'
    `;
    if (rows.length > 0) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }

  throw new Error('Timed out waiting for the PgBouncer-backed transaction lock.');
}

const REVOKED_STATUSES = [
  HouseholdMembershipStatus.Suspended,
  HouseholdMembershipStatus.Left,
  HouseholdMembershipStatus.Removed,
] as const;

describe.sequential('RLS membership revocation through PgBouncer transaction pooling', () => {
  let admin: PrismaService;
  let app: RlsProbeClient;
  let context: { actorUserId: string; householdId: string };
  let membershipId: string;
  let resourceId: string;

  beforeAll(async () => {
    const appDatabaseUrl = process.env.RLS_SPIKE_APP_DATABASE_URL;
    const appPassword = process.env.RLS_SPIKE_APP_PASSWORD;
    const jobPassword = process.env.RLS_SPIKE_JOB_PASSWORD;
    if (appDatabaseUrl === undefined || appPassword === undefined || jobPassword === undefined) {
      throw new Error('PgBouncer RLS spike environment is incomplete.');
    }

    admin = new PrismaService(rlsSpikeAdminDatabaseUrl());
    await admin.$connect();
    await removeRlsSpike(admin);
    await cleanStoryOneTables(admin);
    await installRlsSpike(admin, { appPassword, jobPassword });

    const user = await admin.user.create({ data: {} });
    const household = await admin.household.create({
      data: { name: 'Pooler revocation household' },
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

    app = createRlsProbeClient(appDatabaseUrl, 2);
    await app.$connect();
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
      VALUES (${context.householdId}::uuid, 'pooler-revocation-target', 'before revocation')
      RETURNING id::text AS id
    `;
    if (resource === undefined) throw new Error('Failed to seed the pooler revocation resource.');
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
    're-evaluates %s on the next statement while PgBouncer pins the transaction backend',
    async (status) => {
      const firstReadCompleted = deferred<void>();
      const continueTransaction = deferred<void>();

      const actor = withRlsContext(app, context, { intent: 'read' }, async (transaction, pid) => {
        const before = await transaction.probeResource.findMany({ where: { id: resourceId } });
        firstReadCompleted.resolve(undefined);
        await continueTransaction.promise;
        const after = await transaction.probeResource.findMany({ where: { id: resourceId } });
        return { after, before, pid };
      });

      await firstReadCompleted.promise;
      await admin.householdMembership.update({ data: { status }, where: { id: membershipId } });
      continueTransaction.resolve(undefined);
      const result = await actor;

      expect(result.before).toEqual([expect.objectContaining({ id: resourceId })]);
      expect(result.after).toEqual([]);

      const withoutContext = await app.$transaction(async (transaction) => {
        const [settings] = await transaction.$queryRaw<
          Array<{ actor: string | null; household: string | null; pid: number }>
        >`
          SELECT
            NULLIF(pg_catalog.current_setting('app.actor_user_id', true), '') AS actor,
            NULLIF(pg_catalog.current_setting('app.household_id', true), '') AS household,
            pg_catalog.pg_backend_pid()::integer AS pid
        `;
        return settings;
      });
      expect(withoutContext).toEqual({ actor: null, household: null, pid: result.pid });
    },
  );

  it('orders a locked write before revocation and releases both lock and context on commit', async () => {
    const writeLockAcquired = deferred<number>();
    const finishWrite = deferred<void>();
    const revokerPid = deferred<number>();
    const order: string[] = [];

    const operation = withRlsContext(
      app,
      context,
      { intent: 'write' },
      async (transaction, pid) => {
        writeLockAcquired.resolve(pid);
        await finishWrite.promise;
        await transaction.probeResource.create({
          data: {
            clientKey: 'pooler-locked-before-revocation',
            householdId: context.householdId,
            label: 'ordered first',
          },
        });
      },
    ).then(() => order.push('operation'));
    const operationPid = await writeLockAcquired.promise;

    const revocation = admin
      .$transaction(
        async (transaction) => {
          const [pidRow] = await transaction.$queryRaw<Array<{ pid: number }>>`
            SELECT pg_catalog.pg_backend_pid()::integer AS pid
          `;
          if (pidRow === undefined) throw new Error('Missing PgBouncer revoker pid.');
          revokerPid.resolve(pidRow.pid);
          await transaction.householdMembership.update({
            data: { status: HouseholdMembershipStatus.Suspended },
            where: { id: membershipId },
          });
        },
        { timeout: 10_000 },
      )
      .then(() => order.push('revocation'));

    await waitForLock(admin, { pid: await revokerPid.promise });
    finishWrite.resolve(undefined);
    await Promise.all([operation, revocation]);
    expect(order).toEqual(['operation', 'revocation']);

    const denied = await withRlsContext(
      app,
      context,
      { intent: 'read' },
      async (transaction, pid) => ({
        pid,
        rows: await transaction.probeResource.findMany(),
      }),
    );
    expect(denied).toEqual({ pid: operationPid, rows: [] });
  });

  it('denies a pooler-backed write when revocation owns the membership row first', async () => {
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
          clientKey: 'pooler-must-not-follow-revocation',
          householdId: context.householdId,
          label: 'must not commit',
        },
      }),
    ).then(
      () => ({ error: undefined, succeeded: true }),
      (error: unknown) => ({ error, succeeded: false }),
    );

    await waitForLock(admin, { role: RLS_SPIKE_APP_ROLE });
    commitRevocation.resolve(undefined);
    await expect(revocation).resolves.toBeUndefined();
    const outcome = await operationOutcome;

    expect(outcome.succeeded).toBe(false);
    expect(String(outcome.error)).toContain('active membership required');
    await expect(
      admin.$queryRaw<Array<{ count: bigint }>>`
        SELECT pg_catalog.count(*) AS count
        FROM rls_spike.probe_resource
        WHERE client_key = 'pooler-must-not-follow-revocation'
      `,
    ).resolves.toEqual([{ count: 0n }]);
  });

  it('releases the pooler-backed membership lock on rollback without committing partial data', async () => {
    const writeLockAcquired = deferred<void>();
    const rollBackWrite = deferred<void>();
    const revokerPid = deferred<number>();
    const rollback = new Error('ROLLBACK_POOLER_LOCKED_WRITE');

    const operation = withRlsContext(app, context, { intent: 'write' }, async (transaction) => {
      await transaction.probeResource.create({
        data: {
          clientKey: 'pooler-rolled-back-write',
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
        if (pidRow === undefined) throw new Error('Missing rollback revoker pid.');
        revokerPid.resolve(pidRow.pid);
        await transaction.householdMembership.update({
          data: { status: HouseholdMembershipStatus.Left },
          where: { id: membershipId },
        });
      },
      { timeout: 10_000 },
    );

    await waitForLock(admin, { pid: await revokerPid.promise });
    rollBackWrite.resolve(undefined);
    await expect(operation).rejects.toBe(rollback);
    await expect(revocation).resolves.toBeUndefined();
    await expect(
      admin.$queryRaw<Array<{ count: bigint }>>`
        SELECT pg_catalog.count(*) AS count
        FROM rls_spike.probe_resource
        WHERE client_key = 'pooler-rolled-back-write'
      `,
    ).resolves.toEqual([{ count: 0n }]);
  });
});
