import { describe, expect, it } from 'vitest';

import { databaseUrlFromEnvironment } from './database-url';

describe('databaseUrlFromEnvironment', () => {
  it('fails clearly when DATABASE_URL is absent', () => {
    expect(() => databaseUrlFromEnvironment({})).toThrow(/DATABASE_URL is required/);
  });

  it('returns a configured database URL without logging or transforming it', () => {
    const databaseUrl = 'postgresql://local:local@127.0.0.1:5432/local';

    expect(databaseUrlFromEnvironment({ DATABASE_URL: databaseUrl })).toBe(databaseUrl);
  });
});
