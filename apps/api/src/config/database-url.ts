export function databaseUrlFromEnvironment(environment: NodeJS.ProcessEnv = process.env): string {
  const databaseUrl = environment.DATABASE_URL?.trim();

  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error(
      'DATABASE_URL is required. Configure apps/api/.env for local development or provide it through the process environment.',
    );
  }

  return databaseUrl;
}
