import { HEALTH_RESPONSE_EXAMPLE } from '@copiloto/contracts';
import { describe, expect, it, vi } from 'vitest';

import { HealthApiClient, HealthApiClientError, type HttpTransport } from './health-api-client';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json' },
    status,
  });
}

async function expectHealthError(
  request: Promise<unknown>,
  expected: Partial<Pick<HealthApiClientError, 'code' | 'status'>>,
): Promise<void> {
  await expect(request).rejects.toBeInstanceOf(HealthApiClientError);
  await expect(request).rejects.toMatchObject(expected);
}

describe('HealthApiClient', () => {
  it('returns a valid compatible health response', async () => {
    const transport: HttpTransport = async (url) => {
      expect(url).toBe('http://localhost:3000/api/v1/health');
      return jsonResponse({
        ...HEALTH_RESPONSE_EXAMPLE,
        safeFutureField: 'accepted',
      });
    };
    const client = new HealthApiClient({
      baseUrl: 'http://localhost:3000/',
      transport,
    });

    await expect(client.getHealth()).resolves.toMatchObject(HEALTH_RESPONSE_EXAMPLE);
  });

  it('binds the default fetch transport to the global context', async () => {
    const defaultFetch = vi.fn(function (this: typeof globalThis, url: string) {
      expect(this).toBe(globalThis);
      expect(url).toBe('http://localhost:3000/api/v1/health');
      return Promise.resolve(jsonResponse(HEALTH_RESPONSE_EXAMPLE));
    });
    vi.stubGlobal('fetch', defaultFetch);

    try {
      const client = new HealthApiClient({
        baseUrl: 'http://localhost:3000',
      });

      await expect(client.getHealth()).resolves.toMatchObject(HEALTH_RESPONSE_EXAMPLE);
      expect(defaultFetch).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reports an HTTP error with the response status', async () => {
    const client = new HealthApiClient({
      baseUrl: 'http://localhost:3000',
      transport: async () => jsonResponse({ message: 'Unavailable' }, 503),
    });

    await expectHealthError(client.getHealth(), {
      code: 'http',
      status: 503,
    });
  });

  it('reports a response that does not satisfy the contract', async () => {
    const client = new HealthApiClient({
      baseUrl: 'http://localhost:3000',
      transport: async () => jsonResponse({ status: 'unknown' }),
    });

    await expectHealthError(client.getHealth(), {
      code: 'invalidResponse',
    });
  });

  it('aborts and reports a timeout', async () => {
    const transport: HttpTransport = async (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener(
          'abort',
          () => reject(new DOMException('Aborted', 'AbortError')),
          { once: true },
        );
      });
    const client = new HealthApiClient({
      baseUrl: 'http://localhost:3000',
      timeoutMs: 5,
      transport,
    });

    await expectHealthError(client.getHealth(), {
      code: 'timeout',
    });
  });
});
