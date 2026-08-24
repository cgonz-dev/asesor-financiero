import { describe, expect, it } from 'vitest';

import { integrationDatabaseUrl } from './database-test-utils';

describe('integrationDatabaseUrl', () => {
  it('accepts only the documented local prisma dev target', () => {
    const databaseUrl = 'postgresql://postgres:local-only@127.0.0.1:51214/template1';

    expect(integrationDatabaseUrl({ DATABASE_URL: databaseUrl })).toBe(databaseUrl);
  });

  it('rejects an arbitrary database even when it is on localhost', () => {
    expect(() =>
      integrationDatabaseUrl({
        DATABASE_URL: 'postgresql://postgres:local-only@127.0.0.1:5432/personal_database',
      }),
    ).toThrow(/refuse to clean this database/);
  });

  it('accepts the exact ephemeral CI target only when CI is explicit', () => {
    const databaseUrl = 'postgresql://copiloto_ci:ci-only@127.0.0.1:5432/copiloto_financiero_ci';

    expect(integrationDatabaseUrl({ CI: 'true', DATABASE_URL: databaseUrl })).toBe(databaseUrl);
    expect(() => integrationDatabaseUrl({ DATABASE_URL: databaseUrl })).toThrow(
      /refuse to clean this database/,
    );
  });

  it('rejects a remote database even when CI is explicit', () => {
    expect(() =>
      integrationDatabaseUrl({
        CI: 'true',
        DATABASE_URL:
          'postgresql://copiloto_ci:ci-only@database.example.test:5432/copiloto_financiero_ci',
      }),
    ).toThrow(/refuse to clean this database/);
  });
});
