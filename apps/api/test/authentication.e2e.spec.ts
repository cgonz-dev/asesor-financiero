import {
  HealthResponseServerSchema,
  MeResponseServerSchema,
  PublicAuthenticationErrorSchema,
  ReadinessResponseServerSchema,
} from '@copiloto/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApplication } from '../src/create-application';
import type { PrismaService } from '../src/persistence/prisma/prisma.service';
import {
  cleanStoryOneTables,
  createIntegrationPrisma,
  integrationDatabaseUrl,
} from './database-test-utils';
import { startSyntheticAuthServer, type SyntheticAuthServer } from './synthetic-auth';

const LOCAL_WEB_ORIGIN = 'http://localhost:8081';

describe('Auth0 access-token boundary and GET /api/v1/me', () => {
  let app: INestApplication;
  let auth: SyntheticAuthServer;
  let prisma: PrismaService;

  beforeAll(async () => {
    auth = await startSyntheticAuthServer();
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    app = await createApplication({
      authConfiguration: auth.configuration(),
      corsOrigins: [LOCAL_WEB_ORIGIN],
      databaseUrl: integrationDatabaseUrl(),
      docs: false,
      logger: ['error'],
    });
    await app.listen(0, '127.0.0.1');
  });

  beforeEach(async () => {
    await cleanStoryOneTables(prisma);
  });

  afterAll(async () => {
    await cleanStoryOneTables(prisma);
    await Promise.all([app.close(), prisma.$disconnect(), auth.close()]);
  });

  it('keeps health and readiness public', async () => {
    const [health, readiness] = await Promise.all([
      request(app.getHttpServer()).get('/api/v1/health').expect(200),
      request(app.getHttpServer()).get('/api/v1/readiness').expect(200),
    ]);

    expect(HealthResponseServerSchema.parse(health.body)).toEqual(health.body);
    expect(ReadinessResponseServerSchema.parse(readiness.body)).toEqual(readiness.body);
  });

  it('returns a stable safe 401 when the Bearer token is missing', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/me').expect(401);

    expect(PublicAuthenticationErrorSchema.parse(response.body)).toEqual({
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Se requiere una sesión válida.',
    });
  });

  it('maps a verified issuer + subject to one internal User and returns only its minimal profile', async () => {
    const token = await auth.sign({ subject: 'auth0|stable-e2e-user' });
    const first = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    const firstProfile = MeResponseServerSchema.parse(first.body);
    const secondProfile = MeResponseServerSchema.parse(second.body);

    expect(secondProfile).toEqual(firstProfile);
    expect(firstProfile.status).toBe('active');
    expect(Object.keys(firstProfile).sort()).toEqual(['id', 'status']);
    await expect(prisma.user.count()).resolves.toBe(1);
    await expect(prisma.externalIdentity.count()).resolves.toBe(1);
  });

  it('does not auto-link a different subject even when the provider could expose the same email', async () => {
    const [firstToken, secondToken] = await Promise.all([
      auth.sign({ subject: 'auth0|person-a' }),
      auth.sign({ subject: 'auth0|person-b' }),
    ]);
    const first = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${firstToken}`)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(200);

    expect(second.body.id).not.toBe(first.body.id);
    await expect(prisma.user.count()).resolves.toBe(2);
  });

  it('returns the same safe 401 for malformed, wrong-audience and manipulated tokens', async () => {
    const wrongAudience = await auth.sign({ audience: 'https://other-api.example.test' });
    const valid = await auth.sign();
    const segments = valid.split('.');
    const signature = segments[2] as string;
    const manipulated = `${segments[0]}.${segments[1]}.${signature.startsWith('a') ? 'b' : 'a'}${signature.slice(1)}`;

    for (const token of ['not-a-compact-jwt', wrongAudience, manipulated]) {
      const response = await request(app.getHttpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);

      expect(PublicAuthenticationErrorSchema.parse(response.body)).toEqual({
        code: 'AUTHENTICATION_INVALID',
        message: 'La sesión no es válida o ya no está disponible.',
      });
    }
  });

  it('allows Authorization in preflight only for the configured development origin', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/me')
      .set('Origin', LOCAL_WEB_ORIGIN)
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', 'authorization')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe(LOCAL_WEB_ORIGIN);
    expect(response.headers['access-control-allow-headers']).toContain('Authorization');
  });
});
