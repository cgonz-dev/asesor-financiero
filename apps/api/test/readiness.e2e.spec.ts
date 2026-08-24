import { ReadinessResponseServerSchema } from '@copiloto/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../src/create-application';
import { integrationDatabaseUrl } from './database-test-utils';

const UNAVAILABLE_DATABASE_URL = 'postgresql://readiness_test:not-a-secret@127.0.0.1:1/unavailable';

describe('GET /api/v1/readiness', () => {
  let readyApp: INestApplication;
  let unavailableApp: INestApplication;

  beforeAll(async () => {
    [readyApp, unavailableApp] = await Promise.all([
      createApplication({
        databaseUrl: integrationDatabaseUrl(),
        docs: false,
        logger: ['error'],
      }),
      createApplication({
        databaseUrl: UNAVAILABLE_DATABASE_URL,
        docs: false,
        logger: ['error'],
      }),
    ]);
    await Promise.all([readyApp.init(), unavailableApp.init()]);
  });

  afterAll(async () => {
    await Promise.all([readyApp.close(), unavailableApp.close()]);
  });

  it('returns 200 and the strict ready contract when PostgreSQL is available', async () => {
    const response = await request(readyApp.getHttpServer()).get('/api/v1/readiness').expect(200);

    expect(ReadinessResponseServerSchema.parse(response.body)).toEqual({
      status: 'ready',
      service: 'copiloto-financiero-api',
    });
  });

  it('returns a safe 503 response when PostgreSQL is unavailable', async () => {
    const response = await request(unavailableApp.getHttpServer())
      .get('/api/v1/readiness')
      .expect(503);

    expect(ReadinessResponseServerSchema.parse(response.body)).toEqual({
      status: 'notReady',
      service: 'copiloto-financiero-api',
    });

    const serialized = JSON.stringify(response.body);
    for (const internalDetail of [
      'DATABASE_URL',
      '127.0.0.1',
      'readiness_test',
      'not-a-secret',
      'unavailable',
      'Prisma',
    ]) {
      expect(serialized).not.toContain(internalDetail);
    }
  });
});
