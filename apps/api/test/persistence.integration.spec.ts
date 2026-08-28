import {
  HouseholdMembershipStatus,
  HouseholdRole,
  UserStatus,
  type VerifiedExternalIdentity,
} from '@copiloto/domain';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  HouseholdMembershipStatus as PrismaMembershipStatus,
  HouseholdRole as PrismaHouseholdRole,
  Prisma,
} from '../src/generated/prisma/client';
import { CreateHousehold } from '../src/households/application/create-household';
import { ListUserHouseholds } from '../src/households/application/list-user-households';
import { PrismaHouseholdRepository } from '../src/households/infrastructure/prisma-household.repository';
import { ResolveOrCreateUserFromExternalIdentity } from '../src/identity/application/resolve-or-create-user-from-external-identity';
import { PrismaIdentityRepository } from '../src/identity/infrastructure/prisma-identity.repository';
import type { PrismaService } from '../src/persistence/prisma/prisma.service';
import { cleanStoryOneTables, createIntegrationPrisma } from './database-test-utils';

function externalIdentity(
  subject: string,
  overrides: Partial<VerifiedExternalIdentity> = {},
): VerifiedExternalIdentity {
  return {
    issuer: 'https://identity.example.test/',
    subject,
    provider: 'test-provider',
    ...overrides,
  };
}

describe('Phase 2 story 1 PostgreSQL persistence', () => {
  let prisma: PrismaService;
  let resolveIdentity: ResolveOrCreateUserFromExternalIdentity;
  let householdRepository: PrismaHouseholdRepository;
  let createHousehold: CreateHousehold;
  let listHouseholds: ListUserHouseholds;

  beforeAll(async () => {
    prisma = createIntegrationPrisma();
    await prisma.$connect();
    const identityRepository = new PrismaIdentityRepository(prisma);
    resolveIdentity = new ResolveOrCreateUserFromExternalIdentity(identityRepository);
    householdRepository = new PrismaHouseholdRepository(prisma);
    createHousehold = new CreateHousehold(householdRepository);
    listHouseholds = new ListUserHouseholds(householdRepository);
  });

  beforeEach(async () => {
    await cleanStoryOneTables(prisma);
  });

  afterAll(async () => {
    await cleanStoryOneTables(prisma);
    await prisma.$disconnect();
  });

  it('persists one internal User and resolves the same issuer + subject idempotently', async () => {
    const identity = externalIdentity('provider|stable-person');

    const first = await resolveIdentity.execute(identity);
    const second = await resolveIdentity.execute(identity);

    expect(first.id).toBe(second.id);
    expect(first.status).toBe(UserStatus.Active);
    await expect(prisma.user.count()).resolves.toBe(1);
    await expect(prisma.externalIdentity.count()).resolves.toBe(1);

    await expect(
      prisma.externalIdentity.create({
        data: {
          issuer: identity.issuer,
          subject: identity.subject,
          provider: identity.provider,
          userId: first.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('converges concurrent resolution of one external identity on one User', async () => {
    const identity = externalIdentity('provider|concurrent-person');

    const users = await Promise.all(
      Array.from({ length: 4 }, () => resolveIdentity.execute(identity)),
    );

    expect(new Set(users.map((user) => user.id)).size).toBe(1);
    await expect(prisma.user.count()).resolves.toBe(1);
    await expect(prisma.externalIdentity.count()).resolves.toBe(1);
  });

  it('never auto-links different identities by matching email', async () => {
    const sharedEmail = 'same-address@example.test';
    const first = await resolveIdentity.execute(
      externalIdentity('provider|person-a', { email: sharedEmail, emailVerified: true }),
    );
    const second = await resolveIdentity.execute(
      externalIdentity('provider|person-b', { email: sharedEmail, emailVerified: true }),
    );

    expect(second.id).not.toBe(first.id);
    await expect(prisma.user.count()).resolves.toBe(2);
    await expect(prisma.externalIdentity.count({ where: { email: sharedEmail } })).resolves.toBe(2);
  });

  it('allows one User to hold multiple explicitly associated external identities', async () => {
    const user = await resolveIdentity.execute(externalIdentity('provider|primary'));

    await prisma.externalIdentity.create({
      data: {
        issuer: 'https://second-issuer.example.test/',
        subject: 'second-provider|same-person',
        provider: 'second-test-provider',
        userId: user.id,
      },
    });

    await expect(prisma.externalIdentity.count({ where: { userId: user.id } })).resolves.toBe(2);
  });

  it('creates each Household atomically with exactly one Owner Active and no fictitious Member', async () => {
    const user = await resolveIdentity.execute(externalIdentity('provider|household-owner'));

    const created = await createHousehold.execute({
      internalUserId: user.id,
      name: '  Hogar piloto  ',
    });

    expect(created.household.name).toBe('Hogar piloto');
    expect(created.membership).toMatchObject({
      householdId: created.household.id,
      userId: user.id,
      role: HouseholdRole.Owner,
      status: HouseholdMembershipStatus.Active,
    });
    await expect(
      prisma.householdMembership.count({ where: { householdId: created.household.id } }),
    ).resolves.toBe(1);
    await expect(
      prisma.householdMembership.count({
        where: { householdId: created.household.id, role: PrismaHouseholdRole.Member },
      }),
    ).resolves.toBe(0);
    await expect(
      prisma.auditEvent.findMany({ where: { resourceId: created.household.id } }),
    ).resolves.toEqual([
      expect.objectContaining({
        action: 'household.created',
        actorUserId: user.id,
        householdId: created.household.id,
        result: 'succeeded',
      }),
    ]);
  });

  it('supports multiple Households per User and lists only Active memberships', async () => {
    const user = await resolveIdentity.execute(externalIdentity('provider|multi-household'));
    const first = await createHousehold.execute({
      internalUserId: user.id,
      name: 'Hogar A',
    });
    const second = await createHousehold.execute({
      internalUserId: user.id,
      name: 'Hogar B',
    });

    await expect(listHouseholds.execute(user.id)).resolves.toHaveLength(2);

    await prisma.householdMembership.update({
      where: { id: second.membership.id },
      data: { status: PrismaMembershipStatus.Suspended },
    });

    const active = await listHouseholds.execute(user.id);
    expect(active.map(({ household }) => household.id)).toEqual([first.household.id]);
  });

  it('enforces one active Owner and one stable membership per Household/User in PostgreSQL', async () => {
    const owner = await resolveIdentity.execute(externalIdentity('provider|owner'));
    const otherUser = await resolveIdentity.execute(externalIdentity('provider|other-user'));
    const created = await createHousehold.execute({
      internalUserId: owner.id,
      name: 'Hogar restringido',
    });

    await expect(
      prisma.householdMembership.create({
        data: {
          householdId: created.household.id,
          userId: otherUser.id,
          role: PrismaHouseholdRole.Owner,
          status: PrismaMembershipStatus.Active,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await expect(
      prisma.householdMembership.create({
        data: {
          householdId: created.household.id,
          userId: owner.id,
          role: PrismaHouseholdRole.Member,
          status: PrismaMembershipStatus.Removed,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await expect(
      prisma.householdMembership.count({
        where: {
          householdId: created.household.id,
          role: PrismaHouseholdRole.Owner,
          status: PrismaMembershipStatus.Active,
        },
      }),
    ).resolves.toBe(1);
  });

  it('rolls back the Household when its membership insert fails inside the production adapter', async () => {
    const name = 'Hogar que debe revertirse';
    const owner = await resolveIdentity.execute(externalIdentity('provider|rollback-owner'));
    const failureConstraint = 'test_force_household_membership_failure';

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "household_membership" DROP CONSTRAINT IF EXISTS "${failureConstraint}"`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "household_membership" ADD CONSTRAINT "${failureConstraint}" CHECK (false) NOT VALID`,
    );

    try {
      await expect(
        createHousehold.execute({ internalUserId: owner.id, name }),
      ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    } finally {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "household_membership" DROP CONSTRAINT IF EXISTS "${failureConstraint}"`,
      );
    }

    await expect(prisma.household.count({ where: { name } })).resolves.toBe(0);
    await expect(prisma.householdMembership.count()).resolves.toBe(0);
  });

  it('rolls back Household and membership when its audit event cannot be persisted', async () => {
    const name = 'Hogar con auditoría atómica';
    const owner = await resolveIdentity.execute(externalIdentity('provider|audit-rollback-owner'));
    const failureConstraint = 'test_reject_household_creation_audit';

    await prisma.$executeRawUnsafe(
      `ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "${failureConstraint}"`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "audit_event" ADD CONSTRAINT "${failureConstraint}" CHECK ("action" <> 'household.created') NOT VALID`,
    );

    try {
      await expect(
        createHousehold.execute({ internalUserId: owner.id, name }),
      ).rejects.toBeDefined();
    } finally {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "audit_event" DROP CONSTRAINT IF EXISTS "${failureConstraint}"`,
      );
    }

    await expect(prisma.household.count({ where: { name } })).resolves.toBe(0);
    await expect(prisma.householdMembership.count()).resolves.toBe(0);
    await expect(prisma.auditEvent.count()).resolves.toBe(0);
  });

  it('scopes active membership lookup by both Household and User', async () => {
    const owner = await resolveIdentity.execute(externalIdentity('provider|scoped-owner'));
    const outsider = await resolveIdentity.execute(externalIdentity('provider|outsider'));
    const created = await createHousehold.execute({
      internalUserId: owner.id,
      name: 'Hogar aislado',
    });
    const outsiderHousehold = await createHousehold.execute({
      internalUserId: outsider.id,
      name: 'Otro hogar',
    });

    await expect(
      householdRepository.findActiveMembership({
        householdId: created.household.id,
        userId: owner.id,
      }),
    ).resolves.toMatchObject({ id: created.membership.id });
    await expect(
      householdRepository.findActiveMembership({
        householdId: created.household.id,
        userId: outsider.id,
      }),
    ).resolves.toBeNull();
    await expect(
      householdRepository.findActiveMembership({
        householdId: outsiderHousehold.household.id,
        userId: outsider.id,
      }),
    ).resolves.toMatchObject({ id: outsiderHousehold.membership.id });
  });
});
