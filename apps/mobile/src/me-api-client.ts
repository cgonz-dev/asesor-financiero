import { MeResponseClientSchema, type MeResponse } from '@copiloto/contracts';

import {
  AuthenticatedApiClient,
  AuthenticatedApiClientError,
  type AuthenticatedApiClientOptions,
} from './authenticated-api-client';

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

type MeApiClientOptions = AuthenticatedApiClientOptions;

interface GetMeOptions {
  signal?: AbortSignal;
}

export class MeApiClient {
  private readonly authenticatedApi: AuthenticatedApiClient;

  constructor(options: MeApiClientOptions) {
    this.authenticatedApi = new AuthenticatedApiClient(options);
  }

  async getMe(options: GetMeOptions = {}): Promise<MeResponse> {
    try {
      const response = await this.authenticatedApi.request(
        '/api/v1/me',
        options.signal === undefined ? {} : { signal: options.signal },
      );
      return this.parseResponse(response);
    } catch (error: unknown) {
      if (error instanceof MeApiClientError) {
        throw error;
      }

      if (error instanceof AuthenticatedApiClientError) {
        throw new MeApiClientError(error.code, error.message, {
          cause: error,
          ...(error.status === undefined ? {} : { status: error.status }),
        });
      }

      throw error;
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
}
