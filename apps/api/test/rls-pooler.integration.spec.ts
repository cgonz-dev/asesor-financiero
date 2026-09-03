import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { HouseholdMembershipStatus, HouseholdRole } from '../src/generated/prisma/client';
import { PrismaService } from '../src/persistence/prisma/prisma.service';
import {
  RLS_SPIKE_APP_ROLE,
  backendPid,
  createRlsProbeClient,
  installRlsSpike,
  removeRlsSpike,
  rlsInstallationIssues,
  rlsSpikeAdminDatabaseUrl,
  withRlsContext,
  type RlsProbeClient,
} from './rls/rls-spike-harness';
import { cleanStoryOneTables } from './database-test-utils';

describe.sequential(
  'pre-Phase 3 PostgreSQL RLS spike through PgBouncer transaction pooling',
  () => {
    let admin: PrismaService;
    let clientA: RlsProbeClient;
    let clientB: RlsProbeClient;
    let householdAId: string;
    let householdBId: string;
    let userAId: string;
    let userBId: string;

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

      const userA = await admin.user.create({ data: {} });
      const userB = await admin.user.create({ data: {} });
      const householdA = await admin.household.create({ data: { name: 'Pooler household A' } });
      const householdB = await admin.household.create({ data: { name: 'Pooler household B' } });
      await admin.householdMembership.create({
        data: {
          householdId: householdA.id,
          role: HouseholdRole.Owner,
          status: HouseholdMembershipStatus.Active,
          userId: userA.id,
        },
      });
      await admin.householdMembership.create({
        data: {
          householdId: householdB.id,
          role: HouseholdRole.Owner,
          status: HouseholdMembershipStatus.Active,
          userId: userB.id,
        },
      });
      householdAId = householdA.id;
      householdBId = householdB.id;
      userAId = userA.id;
      userBId = userB.id;

      clientA = createRlsProbeClient(appDatabaseUrl, 2);
      clientB = createRlsProbeClient(appDatabaseUrl, 2);
      await clientA.$connect();
      await clientB.$connect();
    });

    afterAll(async () => {
      await clientA?.$disconnect();
      await clientB?.$disconnect();
      if (admin !== undefined) {
        await removeRlsSpike(admin);
        await cleanStoryOneTables(admin);
        await admin.$disconnect();
      }
    });

    it('connects through the real no-bypass runtime role with the expected RLS installation', async () => {
      await expect(rlsInstallationIssues(admin)).resolves.toEqual([]);
      const [identity] = await clientA.$queryRaw<
        Array<{ currentUser: string; serverVersion: string; sessionUser: string }>
      >`
      SELECT
        current_user::text AS "currentUser",
        pg_catalog.current_setting('server_version') AS "serverVersion",
        session_user::text AS "sessionUser"
    `;
      expect(identity?.currentUser).toBe(RLS_SPIKE_APP_ROLE);
      expect(identity?.sessionUser).toBe(RLS_SPIKE_APP_ROLE);
      expect(identity?.serverVersion).toMatch(/^18\.4(?:\s|$)/u);
    });

    it('retains context inside one transaction and clears it before the same backend is reassigned', async () => {
      const pidA = await withRlsContext(
        clientA,
        { actorUserId: userAId, householdId: householdAId },
        { intent: 'write' },
        async (transaction, pid) => {
          const created = await transaction.probeResource.create({
            data: {
              clientKey: 'pooler-a',
              householdId: householdAId,
              items: { create: { payload: 'nested-through-pooler' } },
              label: 'A',
            },
            include: { items: true },
          });
          expect(created.items).toHaveLength(1);
          return pid;
        },
      );

      const withoutContext = await clientB.$transaction(async (transaction) => {
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
        clientB,
        { actorUserId: userBId, householdId: householdBId },
        { intent: 'write' },
        async (transaction, pid) => {
          await transaction.probeResource.create({
            data: { clientKey: 'pooler-b', householdId: householdBId, label: 'B' },
          });
          return pid;
        },
      );

      expect(withoutContext.pid).toBe(pidA);
      expect(pidB).toBe(pidA);
      expect(withoutContext.settings).toEqual({ actor: null, household: null });
      expect(withoutContext.rows).toEqual([]);
      await expect(
        withRlsContext(
          clientA,
          { actorUserId: userAId, householdId: householdAId },
          { intent: 'read' },
          (transaction) => transaction.probeResource.findMany({ include: { items: true } }),
        ),
      ).resolves.toEqual([
        expect.objectContaining({
          householdId: householdAId,
          items: [expect.objectContaining({ payload: 'nested-through-pooler' })],
        }),
      ]);
    });

    it('rolls back through PgBouncer without leaking context or partial nested data', async () => {
      await expect(
        withRlsContext(
          clientA,
          { actorUserId: userAId, householdId: householdAId },
          { intent: 'write' },
          (transaction) =>
            transaction.probeResource.create({
              data: {
                clientKey: 'pooler-rollback',
                householdId: householdAId,
                items: { create: { payload: '__force_rollback__' } },
                label: 'must roll back',
              },
            }),
        ),
      ).rejects.toBeDefined();

      await expect(
        admin.$queryRaw<Array<{ count: bigint }>>`
        SELECT pg_catalog.count(*) AS count
          FROM rls_spike.probe_resource
         WHERE client_key = 'pooler-rollback'
      `,
      ).resolves.toEqual([{ count: 0n }]);
      await expect(clientB.probeResource.findMany()).resolves.toEqual([]);
    });
  },
);
