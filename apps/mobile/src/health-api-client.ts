import { HealthResponseClientSchema, type HealthResponse } from '@copiloto/contracts';

export type HttpTransport = (url: string, init: RequestInit) => Promise<Response>;

export type HealthApiClientErrorCode =
  'cancelled' | 'http' | 'invalidResponse' | 'network' | 'timeout';

export class HealthApiClientError extends Error {
  readonly code: HealthApiClientErrorCode;
  readonly status: number | undefined;

  constructor(
    code: HealthApiClientErrorCode,
    message: string,
    options: { cause?: unknown; status?: number } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'HealthApiClientError';
    this.code = code;
    this.status = options.status;
  }
}

interface HealthApiClientOptions {
  baseUrl: string;
  timeoutMs?: number;
  transport?: HttpTransport;
}

interface GetHealthOptions {
  signal?: AbortSignal;
}

export class HealthApiClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly transport: HttpTransport;

  constructor(options: HealthApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.transport = options.transport ?? globalThis.fetch.bind(globalThis);
  }

  async getHealth(options: GetHealthOptions = {}): Promise<HealthResponse> {
    const controller = new AbortController();
    let didTimeout = false;
    const externalSignal = options.signal;
    const forwardCancellation = () => controller.abort(externalSignal?.reason);
    const timeout = setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, this.timeoutMs);

    if (externalSignal?.aborted) {
      clearTimeout(timeout);
      throw new HealthApiClientError('cancelled', 'La consulta fue cancelada.');
    }

    externalSignal?.addEventListener('abort', forwardCancellation, { once: true });

    try {
      let response: Response;

      try {
        response = await this.transport(`${this.baseUrl}/api/v1/health`, {
          headers: {
            accept: 'application/json',
          },
          method: 'GET',
          signal: controller.signal,
        });
      } catch (error) {
        if (didTimeout) {
          throw new HealthApiClientError('timeout', 'La API tardó demasiado en responder.', {
            cause: error,
          });
        }

        if (externalSignal?.aborted) {
          throw new HealthApiClientError('cancelled', 'La consulta fue cancelada.', {
            cause: error,
          });
        }

        throw new HealthApiClientError('network', 'No fue posible conectar con la API.', {
          cause: error,
        });
      }

      if (!response.ok) {
        throw new HealthApiClientError(
          'http',
          `La API respondió con el estado HTTP ${response.status}.`,
          { status: response.status },
        );
      }

      let payload: unknown;

      try {
        payload = await response.json();
      } catch (error) {
        throw new HealthApiClientError(
          'invalidResponse',
          'La API no devolvió un documento JSON válido.',
          { cause: error },
        );
      }

      const parsed = HealthResponseClientSchema.safeParse(payload);

      if (!parsed.success) {
        throw new HealthApiClientError(
          'invalidResponse',
          'La respuesta de la API no cumple el contrato health.',
          { cause: parsed.error },
        );
      }

      return parsed.data;
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener('abort', forwardCancellation);
    }
  }
}
