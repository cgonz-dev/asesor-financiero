import { PrismaService } from '../src/persistence/prisma/prisma.service';

const LOCAL_DATABASE_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

function isDocumentedLocalTestDatabase(url: URL): boolean {
  return (
    LOCAL_DATABASE_HOSTS.has(url.hostname) &&
    url.port === '51214' &&
    url.pathname === '/template1' &&
    url.username === 'postgres'
  );
}

function isEphemeralCiTestDatabase(url: URL, environment: NodeJS.ProcessEnv): boolean {
  return (
    environment.CI === 'true' &&
    LOCAL_DATABASE_HOSTS.has(url.hostname) &&
    url.port === '5432' &&
    url.pathname === '/copiloto_financiero_ci' &&
    url.username === 'copiloto_ci'
  );
}

export function integrationDatabaseUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const value = environment.DATABASE_URL?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(
      'DATABASE_URL is required for PostgreSQL integration tests. Start pnpm db:dev and configure apps/api/.env.',
    );
  }

  const parsed = new URL(value);

  if (
    !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
    (!isDocumentedLocalTestDatabase(parsed) && !isEphemeralCiTestDatabase(parsed, environment))
  ) {
    throw new Error(
      'Integration tests refuse to clean this database. Use the documented local prisma dev instance or the named ephemeral CI database.',
    );
  }

  return value;
}

export function createIntegrationPrisma(): PrismaService {
  return new PrismaService(integrationDatabaseUrl());
}

export async function cleanStoryOneTables(prisma: PrismaService): Promise<void> {
  await prisma.auditEvent.deleteMany();
  await prisma.householdInvitation.deleteMany();
  await prisma.householdMembership.deleteMany();
  await prisma.externalIdentity.deleteMany();
  await prisma.household.deleteMany();
  await prisma.user.deleteMany();
}
