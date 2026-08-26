import {
  CreateHouseholdRequestSchema,
  HouseholdDetailClientSchema,
  HouseholdIdSchema,
  ListHouseholdsResponseClientSchema,
  type CreateHouseholdRequest,
  type HouseholdDetail,
  type ListHouseholdsResponse,
} from '@copiloto/contracts';

import {
  AuthenticatedApiClient,
  AuthenticatedApiClientError,
  type AuthenticatedApiClientErrorCode,
  type AuthenticatedApiClientOptions,
} from './authenticated-api-client';

export type HouseholdsApiClientErrorCode = AuthenticatedApiClientErrorCode | 'invalidResponse';

export class HouseholdsApiClientError extends Error {
  readonly code: HouseholdsApiClientErrorCode;
  readonly status: number | undefined;

  constructor(
    code: HouseholdsApiClientErrorCode,
    message: string,
    options: { cause?: unknown; status?: number } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'HouseholdsApiClientError';
    this.code = code;
    this.status = options.status;
  }
}

export interface HouseholdRequestOptions {
  signal?: AbortSignal;
}

export class HouseholdsApiClient {
  private readonly authenticatedApi: AuthenticatedApiClient;

  constructor(options: AuthenticatedApiClientOptions) {
    this.authenticatedApi = new AuthenticatedApiClient(options);
  }

  async list(options: HouseholdRequestOptions = {}): Promise<ListHouseholdsResponse> {
    return this.request(
      '/api/v1/households',
      ListHouseholdsResponseClientSchema,
      options.signal === undefined ? {} : { signal: options.signal },
      'La respuesta no cumple el contrato de la lista de hogares.',
    );
  }

  async create(
    input: CreateHouseholdRequest,
    options: HouseholdRequestOptions = {},
  ): Promise<HouseholdDetail> {
    const body = CreateHouseholdRequestSchema.parse(input);

    return this.request(
      '/api/v1/households',
      HouseholdDetailClientSchema,
      {
        body,
        method: 'POST',
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      },
      'La respuesta no cumple el contrato del hogar creado.',
    );
  }

  async get(householdId: string, options: HouseholdRequestOptions = {}): Promise<HouseholdDetail> {
    const id = HouseholdIdSchema.parse(householdId);

    return this.request(
      `/api/v1/households/${encodeURIComponent(id)}`,
      HouseholdDetailClientSchema,
      options.signal === undefined ? {} : { signal: options.signal },
      'La respuesta no cumple el contrato del hogar.',
    );
  }

  private async request<T>(
    path: string,
    schema: { safeParse: (value: unknown) => { data?: T; error?: unknown; success: boolean } },
    options: { body?: unknown; method?: 'GET' | 'POST'; signal?: AbortSignal },
    invalidResponseMessage: string,
  ): Promise<T> {
    try {
      const response = await this.authenticatedApi.request(path, options);
      let payload: unknown;

      try {
        payload = await response.json();
      } catch (error: unknown) {
        throw new HouseholdsApiClientError('invalidResponse', 'La API no devolvió JSON válido.', {
          cause: error,
        });
      }

      const parsed = schema.safeParse(payload);

      if (!parsed.success) {
        throw new HouseholdsApiClientError('invalidResponse', invalidResponseMessage, {
          cause: parsed.error,
        });
      }

      return parsed.data as T;
    } catch (error: unknown) {
      if (error instanceof HouseholdsApiClientError) {
        throw error;
      }

      if (error instanceof AuthenticatedApiClientError) {
        throw new HouseholdsApiClientError(error.code, error.message, {
          cause: error,
          ...(error.status === undefined ? {} : { status: error.status }),
        });
      }

      throw error;
    }
  }
}
