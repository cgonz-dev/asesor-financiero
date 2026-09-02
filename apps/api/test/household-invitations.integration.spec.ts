import {
  HouseholdMembershipStatus,
  HouseholdRole,
  type VerifiedExternalIdentity,
} from '@copiloto/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AcceptHouseholdInvitation } from '../src/households/application/accept-household-invitation';
import { CreateHouseholdInvitation } from '../src/households/application/create-household-invitation';
import { CreateHousehold } from '../src/households/application/create-household';
import { HouseholdInvitationUnavailableError } from '../src/households/application/errors';
import type { HouseholdInvitationClock } from '../src/households/application/household-invitation-clock';
import { NodeHouseholdInvitationTokenService } from '../src/households/application/household-invitation-token';
import { HouseholdAuthorizationPolicy } from '../src/households/application/household-authorization.policy';
import { HouseholdContextResolver } from '../src/households/application/household-context-resolver';
import { RevokeHouseholdInvitation } from '../src/households/application/revoke-household-invitation';
import type { UserHousehold } from '../src/households/application/household-repository';
import { PrismaHouseholdInvitationRepository } from '../src/households/infrastructure/prisma-household-invitation.repository';
import { PrismaHouseholdRepository } from '../src/households/infrastructure/prisma-household.repository';
import type { InternalUser } from '../src/identity/application/identity-repository';
import { ResolveOrCreateUserFromExternalIdentity } from '../src/identity/application/resolve-or-create-user-from-external-identity';
import { PrismaIdentityRepository } from '../src/identity/infrastructure/prisma-identity.repository';
import {
  HouseholdMembershipStatus as PrismaMembershipStatus,
  HouseholdRole as PrismaHouseholdRole,
} from '../src/generated/prisma/client';
import type { PrismaService } from '../src/persistence/prisma/prisma.service';
import { cleanStoryOneTables, createIntegrationPrisma } from './database-test-utils';

const START = new Date('2026-08-25T18:00:00.000Z');
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60_000;

class FakeClock implements HouseholdInvitationClock {
  current = new Date(START);

  now(): Date {
    return new Date(this.current);
  }
}

function identity(subject: string, email: string): VerifiedExternalIdentity {
  return {
    email,
    emailVerified: true,
    issuer: 'https://identity.example.test/',
    provider: 'test-provider',
    subject,
  };
}

describe('Household invitations PostgreSQL integration', () => {
  let acceptInvitation: AcceptHouseholdInvitation;
  let clock: FakeClock;
  let createHousehold: CreateHousehold;
  let createInvitation: CreateHouseholdInvitation;
  let invitationRepository: PrismaHouseholdInvitationRepository;
  let prisma: PrismaService;
  let resolveIdentity: ResolveOrCreateUserFromExternalIdentity;
  let revokeInvitation: RevokeHouseholdInvitation;
  let tokenService: NodeHouseholdInvitationTokenService;

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const householdRepository = new PrismaHouseholdRepository(prisma);
    invitationRepository = new PrismaHouseholdInvitationRepository(prisma);
    resolveIdentity = new ResolveOrCreateUserFromExternalIdentity(
      new PrismaIdentityRepository(prisma),
    );
    createHousehold = new CreateHousehold(householdRepository);
    const contextResolver = new HouseholdContextResolver(
      householdRepository,
      new HouseholdAuthorizationPolicy(),
    );
    tokenService = new NodeHouseholdInvitationTokenService();
    clock = new FakeClock();
    createInvitation = new CreateHouseholdInvitation(
      contextResolver,
      invitationRepository,
      tokenService,
      clock,
      { ttlMs: SEVEN_DAYS_MS },
    );
    acceptInvitation = new AcceptHouseholdInvitation(invitationRepository, tokenService, clock);
    revokeInvitation = new RevokeHouseholdInvitation(contextResolver, invitationRepository, clock);
  });

  beforeEach(async () => {
    clock.current = new Date(START);
    await cleanStoryOneTables(prisma);
  });

  afterAll(async () => {
    await cleanStoryOneTables(prisma);
    await prisma.$disconnect();
  });

  async function user(subject: string, email: string): Promise<InternalUser> {
    return resolveIdentity.execute(identity(subject, email));
  }

  async function ownerHousehold(subject = 'owner'): Promise<{
    context: UserHousehold;
    owner: InternalUser;
  }> {
    const owner = await user(subject, `${subject}@example.test`);
    const context = await createHousehold.execute({
      internalUserId: owner.id,
      name: `Hogar ${subject}`,
    });

    return { context, owner };
  }

  async function invitation(
    owner: InternalUser,
    context: UserHousehold,
    targetEmail = 'partner@example.test',
  ) {
    return createInvitation.execute({
      householdId: context.household.id,
      internalUserId: owner.id,
      targetEmail,
    });
  }

  async function accept(rawToken: string, invitedUser: InternalUser, email: string) {
    return acceptInvitation.execute({
      authenticatedEmail: email,
      authenticatedEmailVerified: true,
      internalUserId: invitedUser.id,
      rawToken,
    });
  }

  it('persists only a unique 32-byte hash and creates a secret-free audit event', async () => {
    const { context, owner } = await ownerHousehold();
    const created = await invitation(owner, context, ' Partner@Example.Test ');
    const persisted = await prisma.householdInvitation.findUniqueOrThrow({
      where: { id: created.invitation.id },
    });

    expect(created.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(persisted.targetEmail).toBe('partner@example.test');
    expect(persisted.tokenHash).toHaveLength(32);
    expect(Buffer.from(persisted.tokenHash).toString('base64url')).not.toBe(created.rawToken);
    expect(Buffer.from(persisted.tokenHash)).toEqual(
      Buffer.from(tokenService.hash(created.rawToken)),
    );
    await expect(
      prisma.auditEvent.findMany({ where: { resourceId: created.invitation.id } }),
    ).resolves.toEqual([
      expect.objectContaining({
        action: 'invitation.created',
        actorUserId: owner.id,
        householdId: context.household.id,
        result: 'succeeded',
      }),
    ]);

    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT "column_name"
      FROM "information_schema"."columns"
      WHERE "table_schema" = 'public' AND "table_name" = 'household_invitation'
    `;
    expect(columns.map(({ column_name }) => column_name)).not.toContain('invitation_token');
    expect(columns.map(({ column_name }) => column_name)).not.toContain('raw_token');
  });

  it('atomically creates one Member Active, consumes once and supports a same-User retry', async () => {
    const { context, owner } = await ownerHousehold();
    const partner = await user('partner', 'partner@example.test');
    const created = await invitation(owner, context);

    const first = await accept(created.rawToken, partner, 'partner@example.test');
    const repeated = await accept(created.rawToken, partner, 'partner@example.test');

    expect(first).toMatchObject({
      context: {
        household: { id: context.household.id },
        membership: {
          role: HouseholdRole.Member,
          status: HouseholdMembershipStatus.Active,
          userId: partner.id,
        },
      },
      repeated: false,
    });
    expect(repeated).toMatchObject({ repeated: true });
    await expect(
      prisma.householdMembership.count({
        where: { householdId: context.household.id, userId: partner.id },
      }),
    ).resolves.toBe(1);
    await expect(
      prisma.auditEvent.count({
        where: { action: 'invitation.accepted', resourceId: created.invitation.id },
      }),
    ).resolves.toBe(1);
  });

  it('serializes concurrent same-User acceptance without duplicate membership', async () => {
    const { context, owner } = await ownerHousehold();
    const partner = await user('concurrent-partner', 'partner@example.test');
    const created = await invitation(owner, context);

    const results = await Promise.all([
      accept(created.rawToken, partner, 'partner@example.test'),
      accept(created.rawToken, partner, 'partner@example.test'),
    ]);

    expect(results.map(({ repeated }) => repeated).sort()).toEqual([false, true]);
    await expect(
      prisma.householdMembership.count({
        where: { householdId: context.household.id, userId: partner.id },
      }),
    ).resolves.toBe(1);
  });

  it('allows exactly one of two authenticated Users competing for the same token', async () => {
    const { context, owner } = await ownerHousehold();
    const first = await user('competitor-a', 'shared@example.test');
    const second = await user('competitor-b', 'shared@example.test');
    const created = await invitation(owner, context, 'shared@example.test');

    const results = await Promise.allSettled([
      accept(created.rawToken, first, 'shared@example.test'),
      accept(created.rawToken, second, 'shared@example.test'),
    ]);

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
    await expect(
      prisma.householdMembership.count({
        where: { householdId: context.household.id, role: PrismaHouseholdRole.Member },
      }),
    ).resolves.toBe(1);
  });

  it('makes concurrent revocation and acceptance mutually exclusive', async () => {
    const { context, owner } = await ownerHousehold();
    const partner = await user('revoke-race-partner', 'partner@example.test');
    const created = await invitation(owner, context);

    const results = await Promise.allSettled([
      revokeInvitation.execute({
        householdId: context.household.id,
        internalUserId: owner.id,
        invitationId: created.invitation.id,
      }),
      accept(created.rawToken, partner, 'partner@example.test'),
    ]);
    const persisted = await prisma.householdInvitation.findUniqueOrThrow({
      where: { id: created.invitation.id },
    });

    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(persisted.revokedAt === null).not.toBe(persisted.acceptedAt === null);
    await expect(
      prisma.householdMembership.count({
        where: { householdId: context.household.id, userId: partner.id },
      }),
    ).resolves.toBe(persisted.acceptedAt === null ? 0 : 1);
  });

  it('rejects expiration at the exact boundary using the injected clock', async () => {
    const { context, owner } = await ownerHousehold();
    const partner = await user('expired-partner', 'partner@example.test');
    const created = await invitation(owner, context);
    clock.current = new Date(created.invitation.expiresAt);

    await expect(accept(created.rawToken, partner, 'partner@example.test')).rejects.toBeInstanceOf(
      HouseholdInvitationUnavailableError,
    );
    await expect(
      prisma.householdMembership.count({
        where: { householdId: context.household.id, userId: partner.id },
      }),
    ).resolves.toBe(0);
  });

  it('does not reactivate a historical membership or change an existing active role', async () => {
    const { context, owner } = await ownerHousehold();
    const historical = await user('historical-partner', 'historical@example.test');
    const historicalInvitation = await invitation(owner, context, 'historical@example.test');
    await prisma.householdMembership.create({
      data: {
        householdId: context.household.id,
        role: PrismaHouseholdRole.Member,
        status: PrismaMembershipStatus.Removed,
        userId: historical.id,
      },
    });

    await expect(
      accept(historicalInvitation.rawToken, historical, 'historical@example.test'),
    ).rejects.toBeInstanceOf(HouseholdInvitationUnavailableError);
    await expect(
      prisma.householdMembership.findUniqueOrThrow({
        where: {
          householdId_userId: { householdId: context.household.id, userId: historical.id },
        },
      }),
    ).resolves.toMatchObject({ status: PrismaMembershipStatus.Removed });

    const selfInvitation = await invitation(owner, context, 'owner@example.test');
    await expect(
      accept(selfInvitation.rawToken, owner, 'owner@example.test'),
    ).resolves.toMatchObject({
      context: { membership: { role: HouseholdRole.Owner } },
    });
    await expect(
      prisma.householdMembership.count({
        where: { householdId: context.household.id, userId: owner.id },
      }),
    ).resolves.toBe(1);
  });

  it('enforces token uniqueness and rejects cross-Household creator relationships', async () => {
    const first = await ownerHousehold('owner-a');
    const second = await ownerHousehold('owner-b');
    const created = await invitation(first.owner, first.context, 'partner@example.test');
    const hash = tokenService.hash(created.rawToken);

    await expect(
      prisma.householdInvitation.create({
        data: {
          createdAt: new Date(START),
          createdByMembershipId: first.context.membership.id,
          expiresAt: new Date(START.getTime() + SEVEN_DAYS_MS),
          householdId: first.context.household.id,
          targetEmail: 'other@example.test',
          tokenHash: Uint8Array.from(hash),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await expect(
      prisma.householdInvitation.create({
        data: {
          createdAt: new Date(START),
          createdByMembershipId: first.context.membership.id,
          expiresAt: new Date(START.getTime() + SEVEN_DAYS_MS),
          householdId: second.context.household.id,
          targetEmail: 'other@example.test',
          tokenHash: Uint8Array.from(tokenService.generate().tokenHash),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rolls back membership and consumption when acceptance audit persistence fails', async () => {
    const { context, owner } = await ownerHousehold();
    const partner = await user('rollback-partner', 'partner@example.test');
    const created = await invitation(owner, context);
    const constraint = 'test_reject_invitation_acceptance_audit';

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "audit_event" ADD CONSTRAINT "${constraint}" CHECK ("action" <> 'invitation.accepted') NOT VALID`,
    );

    try {
      await expect(accept(created.rawToken, partner, 'partner@example.test')).rejects.toBeDefined();
    } finally {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "${constraint}"`,
      );
    }

    await expect(
      prisma.householdMembership.count({
        where: { householdId: context.household.id, userId: partner.id },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.householdInvitation.findUniqueOrThrow({ where: { id: created.invitation.id } }),
    ).resolves.toMatchObject({ acceptedAt: null, acceptedByUserId: null });
  });
});
