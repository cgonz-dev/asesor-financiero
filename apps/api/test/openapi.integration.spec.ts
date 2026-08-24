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

  it('is deterministic across repeated generation', () => {
    const first = canonicalJson(createOpenApiDocument(app));
    const second = canonicalJson(createOpenApiDocument(app));

    expect(second).toBe(first);
  });
});
