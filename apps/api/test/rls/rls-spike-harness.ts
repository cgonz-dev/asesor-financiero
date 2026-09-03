import { randomBytes } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';

import { Prisma, PrismaClient as RlsProbePrismaClient } from '../../src/generated/rls-probe/client';
import type { PrismaService } from '../../src/persistence/prisma/prisma.service';

export const RLS_SPIKE_SCHEMA = 'rls_spike';
export const RLS_SPIKE_OWNER_ROLE = 'rls_spike_owner';
export const RLS_SPIKE_AUTHORIZER_ROLE = 'rls_spike_authorizer';
export const RLS_SPIKE_APP_ROLE = 'rls_spike_app';
export const RLS_SPIKE_JOB_ROLE = 'rls_spike_job';
export const RLS_ISOLATION_LEVEL = Prisma.TransactionIsolationLevel;

const SPIKE_ROLES = [
  RLS_SPIKE_APP_ROLE,
  RLS_SPIKE_JOB_ROLE,
  RLS_SPIKE_AUTHORIZER_ROLE,
  RLS_SPIKE_OWNER_ROLE,
] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export type RlsProbeClient = RlsProbePrismaClient;
export type RlsProbeTransaction = Prisma.TransactionClient;

export interface RlsContext {
  actorUserId: string;
  householdId: string;
}

export interface RlsTransactionOptions {
  intent: 'read' | 'write';
  isolationLevel?: Prisma.TransactionIsolationLevel;
  timeoutMs?: number;
}

export interface InstalledRlsSpike {
  appPassword: string;
  jobPassword: string;
}

interface SqlClient {
  $executeRawUnsafe(query: string): Promise<number>;
  $queryRawUnsafe<T>(query: string): Promise<T>;
}

function quoteSqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function generatedPassword(): string {
  return randomBytes(32).toString('base64url');
}

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${label} must be a valid UUID.`);
  }
}

export function databaseUrlForRole(baseUrl: string, role: string, password: string): string {
  const url = new URL(baseUrl);
  url.username = role;
  url.password = password;
  url.searchParams.delete('schema');
  return url.toString();
}

export function rlsSpikeAdminDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment.RLS_SPIKE_ADMIN_DATABASE_URL?.trim();
  if (value === undefined || value.length === 0) {
    throw new Error(
      'RLS_SPIKE_ADMIN_DATABASE_URL is required. Use pnpm test:rls:direct or pnpm test:rls:pooler.',
    );
  }

  const url = new URL(value);
  const localHost = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (
    environment.RLS_SPIKE_CONTAINER !== 'true' ||
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !localHost ||
    url.pathname !== '/copiloto_rls_spike' ||
    url.username !== 'rls_spike_admin'
  ) {
    throw new Error(
      'RLS spike refuses to operate outside its disposable local PostgreSQL container.',
    );
  }

  return value;
}

export function createRlsProbeClient(databaseUrl: string, max = 2): RlsProbeClient {
  const adapter = new PrismaPg({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    max,
  });

  return new RlsProbePrismaClient({ adapter });
}

async function executeStatements(client: SqlClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) {
    await client.$executeRawUnsafe(statement);
  }
}

export async function removeRlsSpike(admin: PrismaService): Promise<void> {
  await admin.$executeRawUnsafe(
    `SELECT pg_catalog.pg_terminate_backend(pid)
       FROM pg_catalog.pg_stat_activity
      WHERE usename IN ('${RLS_SPIKE_APP_ROLE}', '${RLS_SPIKE_JOB_ROLE}')
        AND pid <> pg_catalog.pg_backend_pid()`,
  );
  await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS ${RLS_SPIKE_SCHEMA} CASCADE`);

  const existingRoles = await admin.$queryRawUnsafe<Array<{ rolname: string }>>(
    `SELECT rolname
       FROM pg_catalog.pg_roles
      WHERE rolname IN ('${RLS_SPIKE_OWNER_ROLE}', '${RLS_SPIKE_AUTHORIZER_ROLE}', '${RLS_SPIKE_APP_ROLE}', '${RLS_SPIKE_JOB_ROLE}')`,
  );
  const existingRoleNames = new Set(existingRoles.map(({ rolname }) => rolname));

  for (const role of SPIKE_ROLES) {
    if (existingRoleNames.has(role)) {
      await admin.$executeRawUnsafe(`DROP OWNED BY ${role} CASCADE`);
      await admin.$executeRawUnsafe(`DROP ROLE ${role}`);
    }
  }
}

export async function installRlsSpike(
  admin: PrismaService,
  passwords: Partial<InstalledRlsSpike> = {},
): Promise<InstalledRlsSpike> {
  const appPassword = passwords.appPassword ?? generatedPassword();
  const jobPassword = passwords.jobPassword ?? generatedPassword();

  await removeRlsSpike(admin);

  await executeStatements(admin, [
    `CREATE ROLE ${RLS_SPIKE_OWNER_ROLE} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
    `CREATE ROLE ${RLS_SPIKE_AUTHORIZER_ROLE} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
    `CREATE ROLE ${RLS_SPIKE_APP_ROLE} LOGIN PASSWORD ${quoteSqlLiteral(appPassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
    `CREATE ROLE ${RLS_SPIKE_JOB_ROLE} LOGIN PASSWORD ${quoteSqlLiteral(jobPassword)} NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS`,
    `CREATE SCHEMA ${RLS_SPIKE_SCHEMA} AUTHORIZATION ${RLS_SPIKE_OWNER_ROLE}`,
    `REVOKE ALL ON SCHEMA ${RLS_SPIKE_SCHEMA} FROM PUBLIC`,
    `GRANT USAGE ON SCHEMA public TO ${RLS_SPIKE_OWNER_ROLE}`,
    `GRANT SELECT ON TABLE public.app_user, public.household_membership TO ${RLS_SPIKE_OWNER_ROLE}`,
    `GRANT USAGE ON SCHEMA public TO ${RLS_SPIKE_AUTHORIZER_ROLE}`,
    `GRANT SELECT ON TABLE public.app_user, public.household_membership TO ${RLS_SPIKE_AUTHORIZER_ROLE}`,
    `GRANT UPDATE (status) ON TABLE public.household_membership TO ${RLS_SPIKE_AUTHORIZER_ROLE}`,
    `CREATE TABLE ${RLS_SPIKE_SCHEMA}.probe_resource (
       id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
       household_id uuid NOT NULL REFERENCES public.household(id) ON DELETE RESTRICT ON UPDATE CASCADE,
       client_key varchar(64) NOT NULL,
       global_key varchar(64),
       label varchar(100) NOT NULL,
       CONSTRAINT uq_probe_resource_id_household UNIQUE (id, household_id),
       CONSTRAINT uq_probe_resource_household_client_key UNIQUE (household_id, client_key),
       CONSTRAINT uq_probe_resource_global_key UNIQUE (global_key)
     )`,
    `CREATE INDEX idx_probe_resource_household_id ON ${RLS_SPIKE_SCHEMA}.probe_resource (household_id, id)`,
    `CREATE TABLE ${RLS_SPIKE_SCHEMA}.probe_item (
       id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
       resource_id uuid NOT NULL,
       household_id uuid NOT NULL,
       payload varchar(100) NOT NULL,
       CONSTRAINT chk_probe_item_payload CHECK (payload <> '__force_rollback__'),
       CONSTRAINT fk_probe_item_resource_household
         FOREIGN KEY (resource_id, household_id)
         REFERENCES ${RLS_SPIKE_SCHEMA}.probe_resource(id, household_id)
         ON DELETE RESTRICT ON UPDATE CASCADE
     )`,
    `CREATE INDEX idx_probe_item_household_resource ON ${RLS_SPIKE_SCHEMA}.probe_item (household_id, resource_id)`,
    `ALTER TABLE ${RLS_SPIKE_SCHEMA}.probe_resource OWNER TO ${RLS_SPIKE_OWNER_ROLE}`,
    `ALTER TABLE ${RLS_SPIKE_SCHEMA}.probe_item OWNER TO ${RLS_SPIKE_OWNER_ROLE}`,
    `CREATE FUNCTION ${RLS_SPIKE_SCHEMA}.current_actor_is_active_member()
       RETURNS boolean
       LANGUAGE sql
       STABLE
       SECURITY DEFINER
       SET search_path = pg_catalog
       AS $$
         SELECT EXISTS (
           SELECT 1
             FROM public.app_user AS app_user
             JOIN public.household_membership AS membership
               ON membership.user_id = app_user.id
            WHERE app_user.id = NULLIF(pg_catalog.current_setting('app.actor_user_id', true), '')::uuid
              AND app_user.status = 'active'::public.user_status
              AND membership.household_id = NULLIF(pg_catalog.current_setting('app.household_id', true), '')::uuid
              AND membership.status = 'active'::public.household_membership_status
         )
       $$`,
    `ALTER FUNCTION ${RLS_SPIKE_SCHEMA}.current_actor_is_active_member() OWNER TO ${RLS_SPIKE_OWNER_ROLE}`,
    `REVOKE ALL ON FUNCTION ${RLS_SPIKE_SCHEMA}.current_actor_is_active_member() FROM PUBLIC`,
    `CREATE FUNCTION ${RLS_SPIKE_SCHEMA}.lock_active_membership()
       RETURNS boolean
       LANGUAGE plpgsql
       VOLATILE
       SECURITY DEFINER
       SET search_path = pg_catalog
       AS $$
       BEGIN
         PERFORM 1
           FROM public.household_membership AS membership
           JOIN public.app_user AS app_user
             ON app_user.id = membership.user_id
          WHERE app_user.id = NULLIF(pg_catalog.current_setting('app.actor_user_id', true), '')::uuid
            AND app_user.status = 'active'::public.user_status
            AND membership.household_id = NULLIF(pg_catalog.current_setting('app.household_id', true), '')::uuid
            AND membership.status = 'active'::public.household_membership_status
          FOR SHARE OF membership;

         IF NOT FOUND THEN
           RAISE EXCEPTION USING
             ERRCODE = '42501',
             MESSAGE = 'active membership required';
         END IF;

         RETURN true;
       END
       $$`,
    `ALTER FUNCTION ${RLS_SPIKE_SCHEMA}.lock_active_membership() OWNER TO ${RLS_SPIKE_AUTHORIZER_ROLE}`,
    `REVOKE ALL ON FUNCTION ${RLS_SPIKE_SCHEMA}.lock_active_membership() FROM PUBLIC`,
    `GRANT USAGE ON SCHEMA ${RLS_SPIKE_SCHEMA} TO ${RLS_SPIKE_APP_ROLE}, ${RLS_SPIKE_JOB_ROLE}`,
    `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE ${RLS_SPIKE_SCHEMA}.probe_resource, ${RLS_SPIKE_SCHEMA}.probe_item TO ${RLS_SPIKE_APP_ROLE}`,
    `GRANT SELECT ON TABLE ${RLS_SPIKE_SCHEMA}.probe_resource, ${RLS_SPIKE_SCHEMA}.probe_item TO ${RLS_SPIKE_JOB_ROLE}`,
    `GRANT EXECUTE ON FUNCTION ${RLS_SPIKE_SCHEMA}.current_actor_is_active_member() TO ${RLS_SPIKE_APP_ROLE}`,
    `GRANT EXECUTE ON FUNCTION ${RLS_SPIKE_SCHEMA}.lock_active_membership() TO ${RLS_SPIKE_APP_ROLE}`,
    `ALTER TABLE ${RLS_SPIKE_SCHEMA}.probe_resource ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE ${RLS_SPIKE_SCHEMA}.probe_resource FORCE ROW LEVEL SECURITY`,
    `ALTER TABLE ${RLS_SPIKE_SCHEMA}.probe_item ENABLE ROW LEVEL SECURITY`,
    `ALTER TABLE ${RLS_SPIKE_SCHEMA}.probe_item FORCE ROW LEVEL SECURITY`,
    `CREATE POLICY probe_resource_app_policy
       ON ${RLS_SPIKE_SCHEMA}.probe_resource
       FOR ALL TO ${RLS_SPIKE_APP_ROLE}
       USING (
         household_id = NULLIF(pg_catalog.current_setting('app.household_id', true), '')::uuid
         AND ${RLS_SPIKE_SCHEMA}.current_actor_is_active_member()
       )
       WITH CHECK (
         household_id = NULLIF(pg_catalog.current_setting('app.household_id', true), '')::uuid
         AND ${RLS_SPIKE_SCHEMA}.current_actor_is_active_member()
       )`,
    `CREATE POLICY probe_item_app_policy
       ON ${RLS_SPIKE_SCHEMA}.probe_item
       FOR ALL TO ${RLS_SPIKE_APP_ROLE}
       USING (
         household_id = NULLIF(pg_catalog.current_setting('app.household_id', true), '')::uuid
         AND ${RLS_SPIKE_SCHEMA}.current_actor_is_active_member()
       )
       WITH CHECK (
         household_id = NULLIF(pg_catalog.current_setting('app.household_id', true), '')::uuid
         AND ${RLS_SPIKE_SCHEMA}.current_actor_is_active_member()
       )`,
    `CREATE POLICY probe_resource_job_policy
       ON ${RLS_SPIKE_SCHEMA}.probe_resource
       FOR SELECT TO ${RLS_SPIKE_JOB_ROLE}
       USING (household_id = NULLIF(pg_catalog.current_setting('app.household_id', true), '')::uuid)`,
    `CREATE POLICY probe_item_job_policy
       ON ${RLS_SPIKE_SCHEMA}.probe_item
       FOR SELECT TO ${RLS_SPIKE_JOB_ROLE}
       USING (household_id = NULLIF(pg_catalog.current_setting('app.household_id', true), '')::uuid)`,
  ]);

  return { appPassword, jobPassword };
}

export async function backendPid(transaction: RlsProbeTransaction): Promise<number> {
  const [row] = await transaction.$queryRaw<Array<{ backendPid: number }>>`
    SELECT pg_catalog.pg_backend_pid()::integer AS "backendPid"
  `;

  if (row === undefined) {
    throw new Error('PostgreSQL did not return a backend pid.');
  }

  return row.backendPid;
}

export async function withRlsContext<T>(
  prisma: RlsProbeClient,
  context: RlsContext,
  options: RlsTransactionOptions,
  work: (transaction: RlsProbeTransaction, backendPid: number) => Promise<T>,
): Promise<T> {
  assertUuid(context.actorUserId, 'actorUserId');
  assertUuid(context.householdId, 'householdId');

  return prisma.$transaction(
    async (transaction) => {
      if (options.intent === 'read') {
        await transaction.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      }
      const pidBefore = await backendPid(transaction);
      await transaction.$queryRaw`
      SELECT
        pg_catalog.set_config('app.actor_user_id', ${context.actorUserId}, true),
        pg_catalog.set_config('app.household_id', ${context.householdId}, true)
    `;
      if (options.intent === 'write') {
        await transaction.$queryRaw`
          SELECT ${Prisma.raw(`${RLS_SPIKE_SCHEMA}.lock_active_membership()`)}
        `;
      }
      const result = await work(transaction, pidBefore);
      const pidAfter = await backendPid(transaction);

      if (pidAfter !== pidBefore) {
        throw new Error('RLS context and tenant query used different PostgreSQL connections.');
      }

      return result;
    },
    {
      isolationLevel: options.isolationLevel ?? Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5_000,
      timeout: options.timeoutMs ?? 10_000,
    },
  );
}

export async function withUnlockedRlsContextForControl<T>(
  prisma: RlsProbeClient,
  context: RlsContext,
  isolationLevel: Prisma.TransactionIsolationLevel,
  work: (transaction: RlsProbeTransaction, backendPid: number) => Promise<T>,
): Promise<T> {
  assertUuid(context.actorUserId, 'actorUserId');
  assertUuid(context.householdId, 'householdId');

  return prisma.$transaction(
    async (transaction) => {
      const pidBefore = await backendPid(transaction);
      await transaction.$queryRaw`
        SELECT
          pg_catalog.set_config('app.actor_user_id', ${context.actorUserId}, true),
          pg_catalog.set_config('app.household_id', ${context.householdId}, true)
      `;
      const result = await work(transaction, pidBefore);
      const pidAfter = await backendPid(transaction);

      if (pidAfter !== pidBefore) {
        throw new Error(
          'RLS control context and tenant query used different PostgreSQL connections.',
        );
      }

      return result;
    },
    { isolationLevel, maxWait: 5_000, timeout: 10_000 },
  );
}

export async function withJobHouseholdContext<T>(
  prisma: RlsProbeClient,
  householdId: string,
  work: (transaction: RlsProbeTransaction, backendPid: number) => Promise<T>,
): Promise<T> {
  assertUuid(householdId, 'householdId');

  return prisma.$transaction(
    async (transaction) => {
      const pidBefore = await backendPid(transaction);
      await transaction.$queryRaw`
      SELECT pg_catalog.set_config('app.household_id', ${householdId}, true)
    `;
      const result = await work(transaction, pidBefore);
      const pidAfter = await backendPid(transaction);

      if (pidAfter !== pidBefore) {
        throw new Error('Job RLS context and tenant query used different PostgreSQL connections.');
      }

      return result;
    },
    { maxWait: 5_000, timeout: 10_000 },
  );
}

export async function rlsInstallationIssues(client: SqlClient): Promise<string[]> {
  const issues: string[] = [];
  const relations = await client.$queryRawUnsafe<
    Array<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean; owner: string }>
  >(
    `SELECT class.relname,
            class.relrowsecurity,
            class.relforcerowsecurity,
            owner.rolname AS owner
       FROM pg_catalog.pg_class AS class
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = class.relnamespace
       JOIN pg_catalog.pg_roles AS owner ON owner.oid = class.relowner
      WHERE namespace.nspname = '${RLS_SPIKE_SCHEMA}'
        AND class.relname IN ('probe_resource', 'probe_item')
      ORDER BY class.relname`,
  );

  if (relations.length !== 2) {
    issues.push('expected both RLS probe tables');
  }
  for (const relation of relations) {
    if (!relation.relrowsecurity) issues.push(`${relation.relname} does not enable RLS`);
    if (!relation.relforcerowsecurity) issues.push(`${relation.relname} does not force RLS`);
    if (relation.owner !== RLS_SPIKE_OWNER_ROLE) {
      issues.push(`${relation.relname} has unexpected owner ${relation.owner}`);
    }
  }

  const roles = await client.$queryRawUnsafe<
    Array<{
      rolname: string;
      rolcanlogin: boolean;
      rolsuper: boolean;
      rolinherit: boolean;
      rolbypassrls: boolean;
    }>
  >(
    `SELECT rolname, rolcanlogin, rolsuper, rolinherit, rolbypassrls
       FROM pg_catalog.pg_roles
      WHERE rolname IN ('${RLS_SPIKE_OWNER_ROLE}', '${RLS_SPIKE_AUTHORIZER_ROLE}', '${RLS_SPIKE_APP_ROLE}', '${RLS_SPIKE_JOB_ROLE}')`,
  );
  if (roles.length !== 4) issues.push('expected all four RLS roles');
  for (const role of roles) {
    if (role.rolsuper) issues.push(`${role.rolname} is superuser`);
    if (role.rolbypassrls) issues.push(`${role.rolname} bypasses RLS`);
    if (role.rolinherit) issues.push(`${role.rolname} unexpectedly inherits privileges`);
    if (
      [RLS_SPIKE_OWNER_ROLE, RLS_SPIKE_AUTHORIZER_ROLE].includes(role.rolname) &&
      role.rolcanlogin
    ) {
      issues.push(`${role.rolname} can login`);
    }
    if (
      ![RLS_SPIKE_OWNER_ROLE, RLS_SPIKE_AUTHORIZER_ROLE].includes(role.rolname) &&
      !role.rolcanlogin
    ) {
      issues.push(`${role.rolname} cannot login`);
    }
  }

  const policies = await client.$queryRawUnsafe<
    Array<{
      cmd: string;
      policyname: string;
      roles: string[];
      qual: string | null;
      withCheck: string | null;
    }>
  >(
    `SELECT policyname::text AS policyname,
            roles::text[] AS roles,
            cmd::text AS cmd,
            qual::text AS qual,
            with_check::text AS "withCheck"
       FROM pg_catalog.pg_policies
      WHERE schemaname = '${RLS_SPIKE_SCHEMA}'
      ORDER BY tablename, policyname`,
  );
  const expectedPolicyNames = new Set([
    'probe_resource_app_policy',
    'probe_item_app_policy',
    'probe_resource_job_policy',
    'probe_item_job_policy',
  ]);
  if (policies.length !== expectedPolicyNames.size) issues.push('unexpected RLS policy count');
  for (const policy of policies) {
    if (!expectedPolicyNames.delete(policy.policyname)) {
      issues.push(`unexpected policy ${policy.policyname}`);
    }
    if (policy.qual === null || !policy.qual.includes("current_setting('app.household_id'")) {
      issues.push(`${policy.policyname} lacks household USING scope`);
    }
    if (policy.policyname.endsWith('_app_policy')) {
      if (policy.cmd !== 'ALL' || policy.roles.join(',') !== RLS_SPIKE_APP_ROLE) {
        issues.push(`${policy.policyname} has unexpected command or roles`);
      }
      if (
        policy.withCheck === null ||
        !policy.withCheck.includes("current_setting('app.household_id'")
      ) {
        issues.push(`${policy.policyname} lacks household WITH CHECK scope`);
      }
      if (policy.qual === null || !policy.qual.includes('current_actor_is_active_member')) {
        issues.push(`${policy.policyname} lacks active membership predicate`);
      }
    } else if (
      policy.cmd !== 'SELECT' ||
      policy.roles.join(',') !== RLS_SPIKE_JOB_ROLE ||
      policy.withCheck !== null
    ) {
      issues.push(`${policy.policyname} has unexpected command or roles`);
    }
  }
  for (const missingPolicy of expectedPolicyNames) {
    issues.push(`missing policy ${missingPolicy}`);
  }

  const [functionRow] = await client.$queryRawUnsafe<
    Array<{
      appCanExecute: boolean;
      configuration: string[] | null;
      jobCanExecute: boolean;
      prosecdef: boolean;
      publicCanExecute: boolean;
    }>
  >(
    `SELECT procedure.prosecdef,
            procedure.proconfig AS configuration,
            pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicCanExecute",
            pg_catalog.has_function_privilege('${RLS_SPIKE_APP_ROLE}', procedure.oid, 'EXECUTE') AS "appCanExecute",
            pg_catalog.has_function_privilege('${RLS_SPIKE_JOB_ROLE}', procedure.oid, 'EXECUTE') AS "jobCanExecute"
       FROM pg_catalog.pg_proc AS procedure
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
      WHERE namespace.nspname = '${RLS_SPIKE_SCHEMA}'
        AND procedure.proname = 'current_actor_is_active_member'`,
  );
  if (functionRow === undefined) {
    issues.push('missing active membership SECURITY DEFINER function');
  } else {
    if (!functionRow.prosecdef) issues.push('membership function is not SECURITY DEFINER');
    if (!functionRow.configuration?.includes('search_path=pg_catalog')) {
      issues.push('membership function search_path is not fixed');
    }
    if (functionRow.publicCanExecute) issues.push('PUBLIC can execute membership function');
    if (!functionRow.appCanExecute) issues.push('runtime cannot execute membership function');
    if (functionRow.jobCanExecute) issues.push('job can execute membership function');
  }

  const [lockFunctionRow] = await client.$queryRawUnsafe<
    Array<{
      appCanExecute: boolean;
      configuration: string[] | null;
      jobCanExecute: boolean;
      owner: string;
      prosecdef: boolean;
      provolatile: string;
      publicCanExecute: boolean;
    }>
  >(
    `SELECT procedure.prosecdef,
            procedure.provolatile::text AS provolatile,
            procedure.proconfig AS configuration,
            owner.rolname AS owner,
            pg_catalog.has_function_privilege('public', procedure.oid, 'EXECUTE') AS "publicCanExecute",
            pg_catalog.has_function_privilege('${RLS_SPIKE_APP_ROLE}', procedure.oid, 'EXECUTE') AS "appCanExecute",
            pg_catalog.has_function_privilege('${RLS_SPIKE_JOB_ROLE}', procedure.oid, 'EXECUTE') AS "jobCanExecute"
       FROM pg_catalog.pg_proc AS procedure
       JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
       JOIN pg_catalog.pg_roles AS owner ON owner.oid = procedure.proowner
      WHERE namespace.nspname = '${RLS_SPIKE_SCHEMA}'
        AND procedure.proname = 'lock_active_membership'`,
  );
  if (lockFunctionRow === undefined) {
    issues.push('missing active membership lock function');
  } else {
    if (!lockFunctionRow.prosecdef) issues.push('membership lock function is not SECURITY DEFINER');
    if (lockFunctionRow.provolatile !== 'v')
      issues.push('membership lock function is not VOLATILE');
    if (lockFunctionRow.owner !== RLS_SPIKE_AUTHORIZER_ROLE) {
      issues.push(`membership lock function has unexpected owner ${lockFunctionRow.owner}`);
    }
    if (!lockFunctionRow.configuration?.includes('search_path=pg_catalog')) {
      issues.push('membership lock function search_path is not fixed');
    }
    if (lockFunctionRow.publicCanExecute)
      issues.push('PUBLIC can execute membership lock function');
    if (!lockFunctionRow.appCanExecute)
      issues.push('runtime cannot execute membership lock function');
    if (lockFunctionRow.jobCanExecute) issues.push('job can execute membership lock function');
  }

  const [privileges] = await client.$queryRawUnsafe<
    Array<{
      appUserSelect: boolean;
      authorizerMembershipStatusUpdate: boolean;
      jobCanWrite: boolean;
      jobResourceSelect: boolean;
      membershipSelect: boolean;
      membershipUpdate: boolean;
      resourceDml: boolean;
    }>
  >(
    `SELECT
       pg_catalog.has_table_privilege('${RLS_SPIKE_APP_ROLE}', 'public.app_user', 'SELECT') AS "appUserSelect",
       pg_catalog.has_table_privilege('${RLS_SPIKE_APP_ROLE}', 'public.household_membership', 'SELECT') AS "membershipSelect",
       pg_catalog.has_table_privilege('${RLS_SPIKE_APP_ROLE}', 'public.household_membership', 'UPDATE') AS "membershipUpdate",
       pg_catalog.has_column_privilege('${RLS_SPIKE_AUTHORIZER_ROLE}', 'public.household_membership', 'status', 'UPDATE') AS "authorizerMembershipStatusUpdate",
       pg_catalog.has_table_privilege('${RLS_SPIKE_APP_ROLE}', '${RLS_SPIKE_SCHEMA}.probe_resource', 'SELECT,INSERT,UPDATE,DELETE') AS "resourceDml",
       pg_catalog.has_table_privilege('${RLS_SPIKE_JOB_ROLE}', '${RLS_SPIKE_SCHEMA}.probe_resource', 'SELECT') AS "jobResourceSelect",
       (pg_catalog.has_table_privilege('${RLS_SPIKE_JOB_ROLE}', '${RLS_SPIKE_SCHEMA}.probe_resource', 'INSERT')
        OR pg_catalog.has_table_privilege('${RLS_SPIKE_JOB_ROLE}', '${RLS_SPIKE_SCHEMA}.probe_resource', 'UPDATE')
        OR pg_catalog.has_table_privilege('${RLS_SPIKE_JOB_ROLE}', '${RLS_SPIKE_SCHEMA}.probe_resource', 'DELETE')) AS "jobCanWrite"`,
  );
  if (privileges === undefined) {
    issues.push('could not inspect runtime grants');
  } else {
    if (privileges.appUserSelect) issues.push('runtime can select app_user directly');
    if (privileges.membershipSelect) issues.push('runtime can select membership directly');
    if (privileges.membershipUpdate) issues.push('runtime can update membership directly');
    if (!privileges.authorizerMembershipStatusUpdate) {
      issues.push('authorizer lacks the column privilege required by FOR SHARE');
    }
    if (!privileges.resourceDml) issues.push('runtime lacks probe DML grants');
    if (!privileges.jobResourceSelect) issues.push('job lacks probe SELECT grant');
    if (privileges.jobCanWrite) issues.push('job unexpectedly has probe write grants');
  }

  return issues;
}
