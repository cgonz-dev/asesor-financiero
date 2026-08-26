import { describe, expect, it, vi } from 'vitest';

import type { TokenProvider } from './auth/token-provider';
import { MeApiClient } from './me-api-client';

const PROFILE = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'active',
} as const;

function tokenProvider(): TokenProvider & { getAccessToken: ReturnType<typeof vi.fn> } {
  return {
    getAccessToken: vi.fn(async ({ forceRefresh = false } = {}) =>
      forceRefresh ? 'refreshed.token.value' : 'initial.token.value',
    ),
    invalidateSession: vi.fn(async () => undefined),
    registerAuthenticatedRequest: () => () => undefined,
  };
}

describe('MeApiClient', () => {
  it('asks the TokenProvider and validates the shared /me contract', async () => {
    const provider = tokenProvider();
    const transport = vi.fn(async (_url: string, init: RequestInit) => {
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer initial.token.value');
      return new Response(JSON.stringify(PROFILE), {
        headers: { 'content-type': 'application/json' },
        status: 200,
      });
    });
    const client = new MeApiClient({
      baseUrl: 'https://api.example.test',
      tokenProvider: provider,
      transport,
    });

    await expect(client.getMe()).resolves.toEqual(PROFILE);
    expect(provider.getAccessToken).toHaveBeenCalledWith({ forceRefresh: false });
  });

  it('renews once after 401 and retries with the new access token', async () => {
    const provider = tokenProvider();
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: 'AUTHENTICATION_INVALID',
            message: 'La sesión no es válida o ya no está disponible.',
          }),
          { status: 401 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(PROFILE), { status: 200 }));
    const client = new MeApiClient({
      baseUrl: 'https://api.example.test',
      tokenProvider: provider,
      transport,
    });

    await expect(client.getMe()).resolves.toEqual(PROFILE);
    expect(provider.getAccessToken).toHaveBeenNthCalledWith(1, { forceRefresh: false });
    expect(provider.getAccessToken).toHaveBeenNthCalledWith(2, { forceRefresh: true });
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it('never loops after a second 401', async () => {
    const provider = tokenProvider();
    const transport = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            code: 'AUTHENTICATION_INVALID',
            message: 'La sesión no es válida o ya no está disponible.',
          }),
          { status: 401 },
        ),
    );
    const client = new MeApiClient({
      baseUrl: 'https://api.example.test',
      tokenProvider: provider,
      transport,
    });

    await expect(client.getMe()).rejects.toMatchObject({
      code: 'unauthorized',
      status: 401,
    });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(provider.invalidateSession).toHaveBeenCalledOnce();
  });
});
