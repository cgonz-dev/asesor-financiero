import { PublicAuthenticationErrorSchema } from '@copiloto/contracts';

import type { TokenProvider } from './auth/token-provider';
import type { HttpTransport } from './health-api-client';

export type AuthenticatedApiClientErrorCode =
  'cancelled' | 'http' | 'network' | 'timeout' | 'unauthorized';

export class AuthenticatedApiClientError extends Error {
  readonly code: AuthenticatedApiClientErrorCode;
  readonly status: number | undefined;

  constructor(
    code: AuthenticatedApiClientErrorCode,
    message: string,
    options: { cause?: unknown; status?: number } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'AuthenticatedApiClientError';
    this.code = code;
    this.status = options.status;
  }
}

export interface AuthenticatedApiClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  tokenProvider: TokenProvider;
  transport?: HttpTransport;
}

export interface AuthenticatedRequestOptions {
  body?: unknown;
  method?: 'GET' | 'POST';
  signal?: AbortSignal;
}

export class AuthenticatedApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly tokenProvider: TokenProvider;
  private readonly transport: HttpTransport;

  constructor(options: AuthenticatedApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.tokenProvider = options.tokenProvider;
    this.transport = options.transport ?? globalThis.fetch.bind(globalThis);
  }

  async request(path: string, options: AuthenticatedRequestOptions = {}): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.send(path, attempt === 1, options);

      if (response.status === 401 && attempt === 0) {
        await this.consumeSafeAuthenticationError(response);
        continue;
      }

      if (response.status === 401) {
        await this.consumeSafeAuthenticationError(response);
        await this.tokenProvider.invalidateSession();
        throw new AuthenticatedApiClientError(
          'unauthorized',
          'La sesión no es válida o ya no está disponible.',
          { status: response.status },
        );
      }

      if (!response.ok) {
        throw new AuthenticatedApiClientError(
          'http',
          `La API respondió con HTTP ${response.status}.`,
          { status: response.status },
        );
      }

      return response;
    }

    throw new AuthenticatedApiClientError('unauthorized', 'La sesión no es válida.');
  }

  private async send(
    path: string,
    forceRefresh: boolean,
    options: AuthenticatedRequestOptions,
  ): Promise<Response> {
    const controller = new AbortController();
    const unregister = this.tokenProvider.registerAuthenticatedRequest(controller);
    let didTimeout = false;
    const forwardCancellation = () => controller.abort(options.signal?.reason);
    const timeout = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, this.timeoutMs);

    if (options.signal?.aborted) {
      clearTimeout(timeout);
      unregister();
      throw new AuthenticatedApiClientError('cancelled', 'La consulta fue cancelada.');
    }

    options.signal?.addEventListener('abort', forwardCancellation, { once: true });

    try {
      const token = await this.tokenProvider.getAccessToken({ forceRefresh });
      const headers = new Headers({
        accept: 'application/json',
        authorization: `Bearer ${token}`,
      });

      if (options.body !== undefined) {
        headers.set('content-type', 'application/json');
      }

      try {
        return await this.transport(`${this.baseUrl}${path}`, {
          ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
          headers,
          method: options.method ?? 'GET',
          signal: controller.signal,
        });
      } catch (error: unknown) {
        if (didTimeout) {
          throw new AuthenticatedApiClientError('timeout', 'La API tardó demasiado en responder.', {
            cause: error,
          });
        }

        if (options.signal?.aborted || controller.signal.aborted) {
          throw new AuthenticatedApiClientError('cancelled', 'La consulta fue cancelada.', {
            cause: error,
          });
        }

        throw new AuthenticatedApiClientError('network', 'No fue posible conectar con la API.', {
          cause: error,
        });
      }
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener('abort', forwardCancellation);
      unregister();
    }
  }

  private async consumeSafeAuthenticationError(response: Response): Promise<void> {
    try {
      PublicAuthenticationErrorSchema.safeParse(await response.json());
    } catch {
      // A malformed 401 remains a generic public authentication failure.
    }
  }
}
