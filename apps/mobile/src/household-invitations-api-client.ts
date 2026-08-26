import {
  AcceptHouseholdInvitationRequestSchema,
  AcceptHouseholdInvitationResponseClientSchema,
  CreateHouseholdInvitationRequestSchema,
  CreateHouseholdInvitationResponseClientSchema,
  HouseholdIdSchema,
  HouseholdInvitationIdSchema,
  ListHouseholdInvitationsResponseClientSchema,
  ListHouseholdMembersResponseClientSchema,
  RevokeHouseholdInvitationResponseClientSchema,
  type AcceptHouseholdInvitationRequest,
  type AcceptHouseholdInvitationResponse,
  type CreateHouseholdInvitationRequest,
  type CreateHouseholdInvitationResponse,
  type ListHouseholdInvitationsResponse,
  type ListHouseholdMembersResponse,
  type RevokeHouseholdInvitationResponse,
} from '@copiloto/contracts';

import {
  AuthenticatedApiClient,
  AuthenticatedApiClientError,
  type AuthenticatedApiClientErrorCode,
  type AuthenticatedApiClientOptions,
} from './authenticated-api-client';

export type HouseholdInvitationsApiClientErrorCode =
  AuthenticatedApiClientErrorCode | 'invalidResponse';

export class HouseholdInvitationsApiClientError extends Error {
  readonly code: HouseholdInvitationsApiClientErrorCode;
  readonly status: number | undefined;

  constructor(
    code: HouseholdInvitationsApiClientErrorCode,
    message: string,
    options: { cause?: unknown; status?: number } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'HouseholdInvitationsApiClientError';
    this.code = code;
    this.status = options.status;
  }
}

export interface InvitationRequestOptions {
  signal?: AbortSignal;
}

export class HouseholdInvitationsApiClient {
  private readonly authenticatedApi: AuthenticatedApiClient;

  constructor(options: AuthenticatedApiClientOptions) {
    this.authenticatedApi = new AuthenticatedApiClient(options);
  }

  create(
    householdId: string,
    input: CreateHouseholdInvitationRequest,
    options: InvitationRequestOptions = {},
  ): Promise<CreateHouseholdInvitationResponse> {
    const id = HouseholdIdSchema.parse(householdId);
    const body = CreateHouseholdInvitationRequestSchema.parse(input);

    return this.request(
      `/api/v1/households/${encodeURIComponent(id)}/invitations`,
      CreateHouseholdInvitationResponseClientSchema,
      {
        body,
        method: 'POST',
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      },
    );
  }

  list(
    householdId: string,
    options: InvitationRequestOptions = {},
  ): Promise<ListHouseholdInvitationsResponse> {
    const id = HouseholdIdSchema.parse(householdId);

    return this.request(
      `/api/v1/households/${encodeURIComponent(id)}/invitations`,
      ListHouseholdInvitationsResponseClientSchema,
      options.signal === undefined ? {} : { signal: options.signal },
    );
  }

  listMembers(
    householdId: string,
    options: InvitationRequestOptions = {},
  ): Promise<ListHouseholdMembersResponse> {
    const id = HouseholdIdSchema.parse(householdId);

    return this.request(
      `/api/v1/households/${encodeURIComponent(id)}/members`,
      ListHouseholdMembersResponseClientSchema,
      options.signal === undefined ? {} : { signal: options.signal },
    );
  }

  revoke(
    householdId: string,
    invitationId: string,
    options: InvitationRequestOptions = {},
  ): Promise<RevokeHouseholdInvitationResponse> {
    const authorizedHouseholdId = HouseholdIdSchema.parse(householdId);
    const id = HouseholdInvitationIdSchema.parse(invitationId);

    return this.request(
      `/api/v1/households/${encodeURIComponent(authorizedHouseholdId)}/invitations/${encodeURIComponent(id)}/revoke`,
      RevokeHouseholdInvitationResponseClientSchema,
      {
        method: 'POST',
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      },
    );
  }

  accept(
    input: AcceptHouseholdInvitationRequest,
    options: InvitationRequestOptions = {},
  ): Promise<AcceptHouseholdInvitationResponse> {
    const body = AcceptHouseholdInvitationRequestSchema.parse(input);

    return this.request(
      '/api/v1/invitations/accept',
      AcceptHouseholdInvitationResponseClientSchema,
      {
        body,
        method: 'POST',
        ...(options.signal === undefined ? {} : { signal: options.signal }),
      },
    );
  }

  private async request<T>(
    path: string,
    schema: { safeParse: (value: unknown) => { data?: T; error?: unknown; success: boolean } },
    options: { body?: unknown; method?: 'GET' | 'POST'; signal?: AbortSignal },
  ): Promise<T> {
    try {
      const response = await this.authenticatedApi.request(path, options);
      let payload: unknown;

      try {
        payload = await response.json();
      } catch (error: unknown) {
        throw new HouseholdInvitationsApiClientError(
          'invalidResponse',
          'La API no devolvió JSON válido.',
          { cause: error },
        );
      }

      const parsed = schema.safeParse(payload);

      if (!parsed.success) {
        throw new HouseholdInvitationsApiClientError(
          'invalidResponse',
          'La respuesta no cumple el contrato de invitaciones.',
          { cause: parsed.error },
        );
      }

      return parsed.data as T;
    } catch (error: unknown) {
      if (error instanceof HouseholdInvitationsApiClientError) {
        throw error;
      }

      if (error instanceof AuthenticatedApiClientError) {
        throw new HouseholdInvitationsApiClientError(error.code, error.message, {
          cause: error,
          ...(error.status === undefined ? {} : { status: error.status }),
        });
      }

      throw error;
    }
  }
}
