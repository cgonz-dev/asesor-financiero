import {
  HOUSEHOLD_FORBIDDEN_ERROR_EXAMPLE,
  HOUSEHOLD_INVITATION_UNAVAILABLE_ERROR_EXAMPLE,
  HOUSEHOLD_VALIDATION_ERROR_EXAMPLE,
  AcceptHouseholdInvitationResponseServerSchema,
  CreateHouseholdInvitationResponseServerSchema,
  HouseholdDetailServerSchema,
  ListHouseholdInvitationsResponseServerSchema,
  ListHouseholdMembersResponseServerSchema,
} from '@copiloto/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApplication } from '../src/create-application';
import {
  HouseholdMembershipStatus as PrismaMembershipStatus,
  HouseholdRole as PrismaHouseholdRole,
} from '../src/generated/prisma/client';
import type { PrismaService } from '../src/persistence/prisma/prisma.service';
import {
  cleanStoryOneTables,
  createIntegrationPrisma,
  integrationDatabaseUrl,
} from './database-test-utils';
import { startSyntheticAuthServer, type SyntheticAuthServer } from './synthetic-auth';

describe('Household invitation HTTP boundary', () => {
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

  async function bearer(
    subject: string,
    email = `${subject.replace(/[^a-z0-9]/gi, '-')}@example.test`,
    emailVerified = true,
  ): Promise<string> {
    return `Bearer ${await auth.sign({ email, emailVerified, subject })}`;
  }

  async function createHousehold(authorization: string, name = 'Hogar invitaciones') {
    const response = await request(app.getHttpServer())
      .post('/api/v1/households')
      .set('Authorization', authorization)
      .send({ name })
      .expect(201);

    return HouseholdDetailServerSchema.parse(response.body);
  }

  async function createInvitation(
    authorization: string,
    householdId: string,
    targetEmail = 'partner@example.test',
  ) {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/households/${householdId}/invitations`)
      .set('Authorization', authorization)
      .send({ targetEmail })
      .expect(201);

    return CreateHouseholdInvitationResponseServerSchema.parse(response.body);
  }

  async function internalUserId(subject: string): Promise<string> {
    return (
      await prisma.externalIdentity.findUniqueOrThrow({
        where: { issuer_subject: { issuer: auth.issuer, subject } },
      })
    ).userId;
  }

  it('requires Auth0 for every invitation and member operation', async () => {
    const householdId = '22222222-2222-4222-8222-222222222222';
    const invitationId = '33333333-3333-4333-8333-333333333333';

    await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/households/${householdId}/invitations`)
        .send({ targetEmail: 'partner@example.test' })
        .expect(401),
      request(app.getHttpServer()).get(`/api/v1/households/${householdId}/invitations`).expect(401),
      request(app.getHttpServer())
        .post(`/api/v1/households/${householdId}/invitations/${invitationId}/revoke`)
        .expect(401),
      request(app.getHttpServer())
        .post('/api/v1/invitations/accept')
        .send({ invitationToken: 'A'.repeat(43) })
        .expect(401),
      request(app.getHttpServer()).get(`/api/v1/households/${householdId}/members`).expect(401),
    ]);
  });

  it('lets only the Owner create and list metadata while returning the raw token once', async () => {
    const ownerAuthorization = await bearer('auth0|owner');
    const household = await createHousehold(ownerAuthorization);
    const created = await createInvitation(
      ownerAuthorization,
      household.id,
      ' Partner@Example.Test ',
    );

    expect(created.invitation).toMatchObject({
      status: 'pending',
      targetEmailHint: 'p***@example.test',
    });
    expect(created.invitationToken).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/households/${household.id}/invitations`)
      .set('Authorization', ownerAuthorization)
      .expect(200);
    const listed = ListHouseholdInvitationsResponseServerSchema.parse(listResponse.body);

    expect(listed.invitations).toEqual([created.invitation]);
    expect(JSON.stringify(listed)).not.toContain(created.invitationToken);
    expect(JSON.stringify(listed)).not.toContain('tokenHash');

    for (const body of [
      { role: 'owner', targetEmail: 'partner@example.test' },
      { targetEmail: 'partner@example.test', userId: '11111111-1111-4111-8111-111111111111' },
    ]) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/households/${household.id}/invitations`)
        .set('Authorization', ownerAuthorization)
        .send(body)
        .expect(400);
      expect(response.body).toEqual(HOUSEHOLD_VALIDATION_ERROR_EXAMPLE);
    }
  });

  it('accepts only the directed verified email and creates Member Active in the stored Household', async () => {
    const ownerAuthorization = await bearer('auth0|owner');
    const partnerAuthorization = await bearer('auth0|partner', 'partner@example.test');
    const household = await createHousehold(ownerAuthorization);
    const created = await createInvitation(ownerAuthorization, household.id);

    await request(app.getHttpServer())
      .get('/api/v1/households')
      .set('Authorization', partnerAuthorization)
      .expect(200, { households: [] });

    const acceptedResponse = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', partnerAuthorization)
      .send({ invitationToken: created.invitationToken })
      .expect(200);
    const accepted = AcceptHouseholdInvitationResponseServerSchema.parse(acceptedResponse.body);

    expect(accepted.household).toMatchObject({ id: household.id, role: 'member' });
    const partnerHouseholds = await request(app.getHttpServer())
      .get('/api/v1/households')
      .set('Authorization', partnerAuthorization)
      .expect(200);
    expect(partnerHouseholds.body.households).toContainEqual(accepted.household);

    const membersResponse = await request(app.getHttpServer())
      .get(`/api/v1/households/${household.id}/members`)
      .set('Authorization', ownerAuthorization)
      .expect(200);
    expect(ListHouseholdMembersResponseServerSchema.parse(membersResponse.body).members).toEqual([
      { isCurrentUser: true, role: 'owner' },
      { isCurrentUser: false, role: 'member' },
    ]);

    const forbidden = await request(app.getHttpServer())
      .post(`/api/v1/households/${household.id}/invitations`)
      .set('Authorization', partnerAuthorization)
      .send({ targetEmail: 'another@example.test' })
      .expect(403);
    expect(forbidden.body).toEqual(HOUSEHOLD_FORBIDDEN_ERROR_EXAMPLE);
  });

  it('keeps invalid, expired, revoked and wrong-recipient tokens publicly uniform', async () => {
    const ownerAuthorization = await bearer('auth0|owner');
    const household = await createHousehold(ownerAuthorization);
    const partnerAuthorization = await bearer('auth0|partner', 'partner@example.test');
    const wrongEmailAuthorization = await bearer('auth0|wrong-email', 'other@example.test');
    const unverifiedAuthorization = await bearer('auth0|unverified', 'partner@example.test', false);
    const wrongRecipient = await createInvitation(ownerAuthorization, household.id);

    for (const authorization of [wrongEmailAuthorization, unverifiedAuthorization]) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/invitations/accept')
        .set('Authorization', authorization)
        .send({ invitationToken: wrongRecipient.invitationToken })
        .expect(409);
      expect(response.body).toEqual(HOUSEHOLD_INVITATION_UNAVAILABLE_ERROR_EXAMPLE);
    }

    const revoked = await createInvitation(ownerAuthorization, household.id);
    await request(app.getHttpServer())
      .post(`/api/v1/households/${household.id}/invitations/${revoked.invitation.id}/revoke`)
      .set('Authorization', ownerAuthorization)
      .expect(200);

    const expired = await createInvitation(ownerAuthorization, household.id);
    const pastCreatedAt = new Date(Date.now() - 2 * 60 * 60_000);
    await prisma.householdInvitation.update({
      where: { id: expired.invitation.id },
      data: {
        createdAt: pastCreatedAt,
        expiresAt: new Date(pastCreatedAt.getTime() + 60 * 60_000),
      },
    });

    for (const invitationToken of [
      'A'.repeat(43),
      revoked.invitationToken,
      expired.invitationToken,
    ]) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/invitations/accept')
        .set('Authorization', partnerAuthorization)
        .send({ invitationToken })
        .expect(409);
      expect(response.body).toEqual(HOUSEHOLD_INVITATION_UNAVAILABLE_ERROR_EXAMPLE);
    }
  });

  it('supports only a same-User retry and rejects reuse by another User without disclosure', async () => {
    const ownerAuthorization = await bearer('auth0|owner');
    const firstAuthorization = await bearer('auth0|first', 'shared@example.test');
    const secondAuthorization = await bearer('auth0|second', 'shared@example.test');
    const household = await createHousehold(ownerAuthorization);
    const created = await createInvitation(ownerAuthorization, household.id, 'shared@example.test');

    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', firstAuthorization)
      .send({ invitationToken: created.invitationToken })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', firstAuthorization)
      .send({ invitationToken: created.invitationToken })
      .expect(200);

    const otherUser = await request(app.getHttpServer())
      .post('/api/v1/invitations/accept')
      .set('Authorization', secondAuthorization)
      .send({ invitationToken: created.invitationToken })
      .expect(409);
    expect(otherUser.body).toEqual(HOUSEHOLD_INVITATION_UNAVAILABLE_ERROR_EXAMPLE);
    await expect(
      prisma.householdMembership.count({
        where: { householdId: household.id, role: PrismaHouseholdRole.Member },
      }),
    ).resolves.toBe(1);
  });

  it('rejects authority injection in acceptance before any membership is created', async () => {
    const ownerAuthorization = await bearer('auth0|owner');
    const partnerAuthorization = await bearer('auth0|partner', 'partner@example.test');
    const household = await createHousehold(ownerAuthorization);
    const created = await createInvitation(ownerAuthorization, household.id);

    for (const injected of [
      { householdId: household.id },
      { role: 'owner' },
      { userId: '11111111-1111-4111-8111-111111111111' },
      { permission: 'invite' },
    ]) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/invitations/accept')
        .set('Authorization', partnerAuthorization)
        .send({ invitationToken: created.invitationToken, ...injected })
        .expect(400);
      expect(response.body).toEqual(HOUSEHOLD_VALIDATION_ERROR_EXAMPLE);
    }

    await expect(
      prisma.householdMembership.count({
        where: { householdId: household.id, role: PrismaHouseholdRole.Member },
      }),
    ).resolves.toBe(0);
  });

  it('prevents invitation IDOR across Households and distinguishes Member 403 from outsider 404', async () => {
    const ownerA = await bearer('auth0|owner-a');
    const ownerB = await bearer('auth0|owner-b');
    const memberA = await bearer('auth0|member-a');
    const householdA = await createHousehold(ownerA, 'Hogar A');
    const householdB = await createHousehold(ownerB, 'Hogar B');
    const invitationA = await createInvitation(ownerA, householdA.id, 'member-a@example.test');
    const invitationB = await createInvitation(ownerB, householdB.id, 'partner-b@example.test');

    await request(app.getHttpServer())
      .get('/api/v1/households')
      .set('Authorization', memberA)
      .expect(200);
    await prisma.householdMembership.create({
      data: {
        householdId: householdA.id,
        role: PrismaHouseholdRole.Member,
        status: PrismaMembershipStatus.Active,
        userId: await internalUserId('auth0|member-a'),
      },
    });

    const memberResponse = await request(app.getHttpServer())
      .get(`/api/v1/households/${householdA.id}/invitations`)
      .set('Authorization', memberA)
      .expect(403);
    expect(memberResponse.body).toEqual(HOUSEHOLD_FORBIDDEN_ERROR_EXAMPLE);

    await request(app.getHttpServer())
      .get(`/api/v1/households/${householdB.id}/invitations`)
      .set('Authorization', ownerA)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdA.id}/invitations/${invitationB.invitation.id}/revoke`)
      .set('Authorization', ownerA)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/api/v1/households/${householdB.id}/invitations/${invitationA.invitation.id}/revoke`)
      .set('Authorization', ownerB)
      .expect(404);
  });
});
