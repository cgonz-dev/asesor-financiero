import { HealthResponseServerSchema } from '@copiloto/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApplication } from '../src/create-application';

const LOCAL_WEB_ORIGIN = 'http://localhost:8081';

describe('GET /api/v1/health', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApplication({
      corsOrigins: [LOCAL_WEB_ORIGIN],
      docs: false,
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 and satisfies the strict shared contract', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(HealthResponseServerSchema.parse(response.body)).toEqual(response.body);
  });

  it('allows the configured Expo web origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', LOCAL_WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(LOCAL_WEB_ORIGIN);
    expect(response.headers['access-control-allow-methods']).toContain('GET');
  });

  it('does not grant CORS access to an unconfigured origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'https://unconfigured.example')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});
