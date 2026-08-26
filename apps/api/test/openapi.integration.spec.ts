import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../src/create-application';
import { canonicalJson } from '../src/openapi/canonical-json';
import { createOpenApiDocument } from '../src/openapi/create-openapi-document';

describe('OpenAPI generation', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApplication({
      databaseUrl: 'postgresql://openapi_test:openapi_test@127.0.0.1:1/unavailable',
      docs: false,
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('documents health with the strict shared response schema', () => {
    const document = createOpenApiDocument(app);
    const healthOperation = document.paths['/api/v1/health']?.get;
    const healthSchema = document.components?.schemas?.HealthResponseDto;

    expect(document.openapi).toBe('3.1.0');
    expect(healthOperation?.responses['200']).toBeDefined();
    expect(healthSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        service: { const: 'copiloto-financiero-api', type: 'string' },
        status: { const: 'ok', type: 'string' },
        version: { minLength: 1, type: 'string' },
      },
      required: ['status', 'service', 'version'],
      type: 'object',
    });
  });

  it('documents both readiness outcomes with the strict shared response schema', () => {
    const document = createOpenApiDocument(app);
    const readinessOperation = document.paths['/api/v1/readiness']?.get;
    const readinessSchema = document.components?.schemas?.ReadinessResponseDto;

    expect(readinessOperation?.responses['200']).toBeDefined();
    expect(readinessOperation?.responses['503']).toBeDefined();
    expect(readinessSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        service: { const: 'copiloto-financiero-api', type: 'string' },
        status: { enum: ['ready', 'notReady'], type: 'string' },
      },
      required: ['status', 'service'],
      type: 'object',
    });
  });

  it('documents the authenticated minimal User profile, safe 401 and Auth0 Bearer scheme', () => {
    const document = createOpenApiDocument(app);
    const meOperation = document.paths['/api/v1/me']?.get;
    const meSchema = document.components?.schemas?.MeResponseDto;
    const authenticationErrorSchema = document.components?.schemas?.AuthenticationErrorDto;

    expect(meOperation?.security).toEqual([{ auth0: [] }]);
    expect(meOperation?.responses['200']).toBeDefined();
    expect(meOperation?.responses['401']).toBeDefined();
    expect(document.components?.securitySchemes?.auth0).toMatchObject({
      bearerFormat: 'JWT',
      scheme: 'bearer',
      type: 'http',
    });
    expect(meSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        id: { format: 'uuid', type: 'string' },
        status: { enum: ['active', 'blocked'], type: 'string' },
      },
      required: ['id', 'status'],
      type: 'object',
    });
    expect(authenticationErrorSchema).toMatchObject({
      additionalProperties: false,
      properties: {
        code: {
          enum: ['AUTHENTICATION_REQUIRED', 'AUTHENTICATION_INVALID'],
          type: 'string',
        },
        message: { minLength: 1, type: 'string' },
      },
      required: ['code', 'message'],
      type: 'object',
    });
  });

  it('documents directed Household invitations without exposing persisted token material', () => {
    const document = createOpenApiDocument(app);
    const invitationCollection = document.paths['/api/v1/households/{householdId}/invitations'];
    const invitationRevocation =
      document.paths['/api/v1/households/{householdId}/invitations/{invitationId}/revoke']?.post;
    const invitationAcceptance = document.paths['/api/v1/invitations/accept']?.post;
    const householdMembers = document.paths['/api/v1/households/{householdId}/members']?.get;
    const createRequest = document.components?.schemas?.CreateHouseholdInvitationRequestDto;
    const acceptRequest = document.components?.schemas?.AcceptHouseholdInvitationRequestDto;
    const createResponse = document.components?.schemas?.CreateHouseholdInvitationResponseDto;
    const serialized = canonicalJson(document);

    expect(invitationCollection?.post?.security).toEqual([{ auth0: [] }]);
    expect(invitationCollection?.get?.security).toEqual([{ auth0: [] }]);
    expect(invitationRevocation?.security).toEqual([{ auth0: [] }]);
    expect(invitationAcceptance?.security).toEqual([{ auth0: [] }]);
    expect(householdMembers?.security).toEqual([{ auth0: [] }]);

    expect(invitationCollection?.post?.responses['201']).toBeDefined();
    expect(invitationCollection?.get?.responses['200']).toBeDefined();
    expect(invitationRevocation?.responses['200']).toBeDefined();
    expect(invitationAcceptance?.responses['200']).toBeDefined();
    expect(householdMembers?.responses['200']).toBeDefined();

    expect(createRequest).toMatchObject({
      additionalProperties: false,
      required: ['targetEmail'],
      type: 'object',
    });
    expect(acceptRequest).toMatchObject({
      additionalProperties: false,
      required: ['invitationToken'],
      type: 'object',
    });
    expect(createResponse).toMatchObject({
      additionalProperties: false,
      required: ['invitation', 'invitationToken'],
      type: 'object',
    });
    expect(serialized).not.toContain('tokenHash');
    expect(serialized).not.toContain('acceptedByUserId');
  });

  it('is deterministic across repeated generation', () => {
    const first = canonicalJson(createOpenApiDocument(app));
    const second = canonicalJson(createOpenApiDocument(app));

    expect(second).toBe(first);
  });
});
