import { describe, expect, it, vi } from 'vitest';

import type { TokenProvider } from './auth/token-provider';
import { HouseholdsApiClient } from './households-api-client';

const HOUSEHOLD = {
  id: '22222222-2222-4222-8222-222222222222',
  membershipStatus: 'active',
  name: 'Hogar de prueba',
  role: 'owner',
} as const;

function tokenProvider(): TokenProvider {
  return {
    getAccessToken: vi.fn(async () => 'access.token'),
    invalidateSession: vi.fn(async () => undefined),
    registerAuthenticatedRequest: () => () => undefined,
  };
}

describe('HouseholdsApiClient', () => {
  it('lists authorized Households through the shared bearer transport', async () => {
    const transport = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://api.example.test/api/v1/households');
      expect(init.method).toBe('GET');
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer access.token');
      return new Response(JSON.stringify({ households: [HOUSEHOLD], futureField: true }), {
        status: 200,
      });
    });
    const client = new HouseholdsApiClient({
      baseUrl: 'https://api.example.test',
      tokenProvider: tokenProvider(),
      transport,
    });

    await expect(client.list()).resolves.toEqual({
      futureField: true,
      households: [HOUSEHOLD],
    });
  });

  it('normalizes and sends only the shared create contract', async () => {
    const transport = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.method).toBe('POST');
      expect(JSON.parse(String(init.body))).toEqual({ name: 'Mi hogar' });
      return new Response(JSON.stringify(HOUSEHOLD), { status: 201 });
    });
    const client = new HouseholdsApiClient({
      baseUrl: 'https://api.example.test',
      tokenProvider: tokenProvider(),
      transport,
    });

    await expect(client.create({ name: '  Mi hogar  ' })).resolves.toEqual(HOUSEHOLD);
  });

  it('gets a specific authorized Household using its URL context', async () => {
    const transport = vi.fn(async (url: string) => {
      expect(url).toBe(`https://api.example.test/api/v1/households/${HOUSEHOLD.id}`);
      return new Response(JSON.stringify(HOUSEHOLD), { status: 200 });
    });
    const client = new HouseholdsApiClient({
      baseUrl: 'https://api.example.test',
      tokenProvider: tokenProvider(),
      transport,
    });

    await expect(client.get(HOUSEHOLD.id)).resolves.toEqual(HOUSEHOLD);
  });

  it('rejects a response that does not satisfy the shared client schema', async () => {
    const client = new HouseholdsApiClient({
      baseUrl: 'https://api.example.test',
      tokenProvider: tokenProvider(),
      transport: vi.fn(async () => new Response(JSON.stringify({ households: [{ id: 3 }] }))),
    });

    await expect(client.list()).rejects.toMatchObject({ code: 'invalidResponse' });
  });
});
