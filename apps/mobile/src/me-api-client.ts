import {
  MeResponseClientSchema,
  PublicAuthenticationErrorSchema,
  type MeResponse,
} from '@copiloto/contracts';

import type { TokenProvider } from './auth/token-provider';
import type { HttpTransport } from './health-api-client';

export type MeApiClientErrorCode =
  'cancelled' | 'http' | 'invalidResponse' | 'network' | 'timeout' | 'unauthorized';

export class MeApiClientError extends Error {
  readonly code: MeApiClientErrorCode;
  readonly status: number | undefined;

  constructor(
    code: MeApiClientErrorCode,
    message: string,
    options: { cause?: unknown; status?: number } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'MeApiClientError';
    this.code = code;
    this.status = options.status;
  }
}

interface MeApiClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  tokenProvider: TokenProvider;
  transport?: HttpTransport;
}

interface GetMeOptions {
  signal?: AbortSignal;
}

export class MeApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly tokenProvider: TokenProvider;
  private readonly transport: HttpTransport;

  constructor(options: MeApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.tokenProvider = options.tokenProvider;
    this.transport = options.transport ?? globalThis.fetch.bind(globalThis);
  }

  async getMe(options: GetMeOptions = {}): Promise<MeResponse> {
    let forceRefresh = false;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.send(forceRefresh, options.signal);

      if (response.status === 401 && attempt === 0) {
        await this.consumeSafeAuthenticationError(response);
        forceRefresh = true;
        continue;
      }

      if (response.status === 401) {
        await this.consumeSafeAuthenticationError(response);
        throw new MeApiClientError(
          'unauthorized',
          'La sesión no es válida o ya no está disponible.',
          { status: response.status },
        );
      }

      if (!response.ok) {
        throw new MeApiClientError('http', `La API respondió con HTTP ${response.status}.`, {
          status: response.status,
        });
      }

      return this.parseResponse(response);
    }

    throw new MeApiClientError('unauthorized', 'La sesión no es válida.');
  }

  private async send(forceRefresh: boolean, externalSignal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const unregister = this.tokenProvider.registerAuthenticatedRequest(controller);
    let didTimeout = false;
    const forwardCancellation = () => controller.abort(externalSignal?.reason);
    const timeout = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, this.timeoutMs);

    if (externalSignal?.aborted) {
      clearTimeout(timeout);
      unregister();
      throw new MeApiClientError('cancelled', 'La consulta fue cancelada.');
    }

    externalSignal?.addEventListener('abort', forwardCancellation, { once: true });

    try {
      const token = await this.tokenProvider.getAccessToken({ forceRefresh });

      try {
        return await this.transport(`${this.baseUrl}/api/v1/me`, {
          headers: {
            accept: 'application/json',
            authorization: `Bearer ${token}`,
          },
          method: 'GET',
          signal: controller.signal,
        });
      } catch (error: unknown) {
        if (didTimeout) {
          throw new MeApiClientError('timeout', 'La API tardó demasiado en responder.', {
            cause: error,
          });
        }

        if (externalSignal?.aborted || controller.signal.aborted) {
          throw new MeApiClientError('cancelled', 'La consulta fue cancelada.', {
            cause: error,
          });
        }

        throw new MeApiClientError('network', 'No fue posible conectar con la API.', {
          cause: error,
        });
      }
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', forwardCancellation);
      unregister();
    }
  }

  private async parseResponse(response: Response): Promise<MeResponse> {
    let payload: unknown;

    try {
      payload = await response.json();
    } catch (error: unknown) {
      throw new MeApiClientError('invalidResponse', 'La API no devolvió JSON válido.', {
        cause: error,
      });
    }

    const parsed = MeResponseClientSchema.safeParse(payload);

    if (!parsed.success) {
      throw new MeApiClientError('invalidResponse', 'La respuesta no cumple el contrato /me.', {
        cause: parsed.error,
      });
    }

    return parsed.data;
  }

  private async consumeSafeAuthenticationError(response: Response): Promise<void> {
    try {
      PublicAuthenticationErrorSchema.safeParse(await response.json());
    } catch {
      // A malformed 401 remains a generic public authentication failure.
    }
  }
}
