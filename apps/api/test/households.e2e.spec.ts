import {
  HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE,
  HOUSEHOLD_VALIDATION_ERROR_EXAMPLE,
  HouseholdDetailServerSchema,
  ListHouseholdsResponseServerSchema,
} from '@copiloto/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApplication } from '../src/create-application';
import { HouseholdMembershipStatus as PrismaMembershipStatus } from '../src/generated/prisma/client';
import type { PrismaService } from '../src/persistence/prisma/prisma.service';
import {
  cleanStoryOneTables,
  createIntegrationPrisma,
  integrationDatabaseUrl,
} from './database-test-utils';
import { startSyntheticAuthServer, type SyntheticAuthServer } from './synthetic-auth';

describe('Authenticated Household HTTP boundary', () => {
  let app: INestApplication;
  let auth: SyntheticAuthServer;
  let prisma: PrismaService;

  beforeAll(async () => {
    auth = await startSyntheticAuthServer();
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    app = await createApplication({
      authConfiguration: auth.configuration(),
      corsOrigins: ['http://localhost:8081'],
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

  async function bearer(subject: string): Promise<string> {
    return `Bearer ${await auth.sign({ subject })}`;
  }

  async function createHousehold(authorization: string, name: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/households')
      .set('Authorization', authorization)
      .send({ name })
      .expect(201);

    return HouseholdDetailServerSchema.parse(response.body);
  }

  it('requires authentication for list, create and detail', async () => {
    await Promise.all([
      request(app.getHttpServer()).get('/api/v1/households').expect(401),
      request(app.getHttpServer()).post('/api/v1/households').send({ name: 'Hogar' }).expect(401),
      request(app.getHttpServer())
        .get('/api/v1/households/22222222-2222-4222-8222-222222222222')
        .expect(401),
    ]);
  });

  it('returns an empty collection for an authenticated User without Households', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/households')
      .set('Authorization', await bearer('auth0|empty-households'))
      .expect(200);

    expect(ListHouseholdsResponseServerSchema.parse(response.body)).toEqual({ households: [] });
  });

  it('creates a normalized Household with exactly one Owner Active', async () => {
    const authorization = await bearer('auth0|create-household');
    const created = await createHousehold(authorization, '  Hogar de prueba  ');

    expect(created).toMatchObject({
      membershipStatus: 'active',
      name: 'Hogar de prueba',
      role: 'owner',
    });
    await expect(
      prisma.householdMembership.count({ where: { householdId: created.id } }),
    ).resolves.toBe(1);
  });

  it('rejects invalid input and never trusts a body userId as authority', async () => {
    const authorization = await bearer('auth0|invalid-household');

    for (const body of [
      { name: '   ' },
      { name: 'H'.repeat(101) },
      { name: 'Hogar', userId: '11111111-1111-4111-8111-111111111111' },
    ]) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/households')
        .set('Authorization', authorization)
        .send(body)
        .expect(400);

      expect(response.body).toEqual(HOUSEHOLD_VALIDATION_ERROR_EXAMPLE);
    }

    await expect(prisma.household.count()).resolves.toBe(0);
  });

  it('lists only Active memberships and supports multiple Households', async () => {
    const authorization = await bearer('auth0|membership-states');
    const active = await createHousehold(authorization, 'Activo');
    const suspended = await createHousehold(authorization, 'Suspendido');
    const left = await createHousehold(authorization, 'Abandonado');
    const removed = await createHousehold(authorization, 'Removido');

    await Promise.all([
      prisma.householdMembership.updateMany({
        where: { householdId: suspended.id },
        data: { status: PrismaMembershipStatus.Suspended },
      }),
      prisma.householdMembership.updateMany({
        where: { householdId: left.id },
        data: { status: PrismaMembershipStatus.Left },
      }),
      prisma.householdMembership.updateMany({
        where: { householdId: removed.id },
        data: { status: PrismaMembershipStatus.Removed },
      }),
    ]);

    const response = await request(app.getHttpServer())
      .get('/api/v1/households')
      .set('Authorization', authorization)
      .expect(200);

    expect(ListHouseholdsResponseServerSchema.parse(response.body).households).toEqual([active]);
  });

  it('returns a Household only through the authenticated Active membership', async () => {
    const authorization = await bearer('auth0|own-household');
    const created = await createHousehold(authorization, 'Hogar propio');

    const response = await request(app.getHttpServer())
      .get(`/api/v1/households/${created.id}`)
      .set('Authorization', authorization)
      .expect(200);

    expect(HouseholdDetailServerSchema.parse(response.body)).toEqual(created);
  });

  it('makes nonexistent, foreign and inactive Households publicly indistinguishable', async () => {
    const authorizationA = await bearer('auth0|person-a');
    const authorizationB = await bearer('auth0|person-b');
    const householdA = await createHousehold(authorizationA, 'Hogar A');
    const householdB = await createHousehold(authorizationB, 'Hogar B');
    const nonexistent = '99999999-9999-4999-8999-999999999999';

    const [listA, listB] = await Promise.all([
      request(app.getHttpServer())
        .get('/api/v1/households')
        .set('Authorization', authorizationA)
        .expect(200),
      request(app.getHttpServer())
        .get('/api/v1/households')
        .set('Authorization', authorizationB)
        .expect(200),
    ]);

    expect(ListHouseholdsResponseServerSchema.parse(listA.body).households).toEqual([householdA]);
    expect(ListHouseholdsResponseServerSchema.parse(listB.body).households).toEqual([householdB]);

    const inaccessibleHouseholds: Array<[string, string]> = [
      [authorizationA, householdB.id],
      [authorizationB, householdA.id],
      [authorizationA, nonexistent],
    ];

    for (const [authorization, householdId] of inaccessibleHouseholds) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/households/${householdId}`)
        .set('Authorization', authorization)
        .expect(404);

      expect(response.body).toEqual(HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE);
    }

    const membership = await prisma.householdMembership.findFirstOrThrow({
      where: { householdId: householdA.id },
    });

    for (const status of [
      PrismaMembershipStatus.Suspended,
      PrismaMembershipStatus.Left,
      PrismaMembershipStatus.Removed,
    ]) {
      await prisma.householdMembership.update({
        where: { id: membership.id },
        data: { status },
      });
      const response = await request(app.getHttpServer())
        .get(`/api/v1/households/${householdA.id}`)
        .set('Authorization', authorizationA)
        .expect(404);
      expect(response.body).toEqual(HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE);
    }
  });

  it('treats two legitimate creates as distinct Households without duplicate Owners', async () => {
    const authorization = await bearer('auth0|two-households');
    const first = await createHousehold(authorization, 'Primero');
    const second = await createHousehold(authorization, 'Segundo');

    expect(second.id).not.toBe(first.id);
    await expect(prisma.household.count()).resolves.toBe(2);
    await expect(prisma.householdMembership.count()).resolves.toBe(2);
    await expect(
      prisma.householdMembership.groupBy({
        by: ['householdId'],
        _count: { _all: true },
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ householdId: first.id, _count: { _all: 1 } }),
        expect.objectContaining({ householdId: second.id, _count: { _all: 1 } }),
      ]),
    );
  });
});
