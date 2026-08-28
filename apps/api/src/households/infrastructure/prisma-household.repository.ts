import { HouseholdMembershipStatus, HouseholdRole } from '@copiloto/domain';
import { Inject, Injectable } from '@nestjs/common';

import {
  HouseholdMembershipStatus as PrismaMembershipStatus,
  HouseholdRole as PrismaHouseholdRole,
  UserStatus as PrismaUserStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import { ActiveInternalUserRequiredError } from '../application/errors';
import type {
  ActiveMembershipScope,
  CreateHouseholdWithInitialOwnerInput,
  HouseholdMembershipRecord,
  HouseholdRecord,
  HouseholdRepository,
  UserHousehold,
} from '../application/household-repository';

const AUDIT_RESULT_SUCCEEDED = 'succeeded';

function toHouseholdRecord(household: {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}): HouseholdRecord {
  return household;
}

function toMembershipRecord(membership: {
  id: string;
  householdId: string;
  userId: string;
  role: PrismaHouseholdRole;
  status: PrismaMembershipStatus;
  createdAt: Date;
  updatedAt: Date;
}): HouseholdMembershipRecord {
  const role =
    membership.role === PrismaHouseholdRole.Owner ? HouseholdRole.Owner : HouseholdRole.Member;

  const status = {
    [PrismaMembershipStatus.Active]: HouseholdMembershipStatus.Active,
    [PrismaMembershipStatus.Suspended]: HouseholdMembershipStatus.Suspended,
    [PrismaMembershipStatus.Left]: HouseholdMembershipStatus.Left,
    [PrismaMembershipStatus.Removed]: HouseholdMembershipStatus.Removed,
  }[membership.status];

  return {
    id: membership.id,
    householdId: membership.householdId,
    userId: membership.userId,
    role,
    status,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  };
}

@Injectable()
export class PrismaHouseholdRepository implements HouseholdRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async createWithInitialOwner(
    input: CreateHouseholdWithInitialOwnerInput,
  ): Promise<UserHousehold> {
    return this.prisma.$transaction(async (databaseTransaction) => {
      const owner = await databaseTransaction.user.findFirst({
        where: {
          id: input.ownerUserId,
          status: PrismaUserStatus.Active,
        },
        select: { id: true, status: true },
      });

      if (owner === null || owner.status !== PrismaUserStatus.Active) {
        throw new ActiveInternalUserRequiredError();
      }

      if (
        input.ownerRole !== HouseholdRole.Owner ||
        input.membershipStatus !== HouseholdMembershipStatus.Active
      ) {
        throw new Error('The initial Household membership must be Owner and Active.');
      }

      const household = await databaseTransaction.household.create({
        data: { name: input.name },
      });

      const membership = await databaseTransaction.householdMembership.create({
        data: {
          householdId: household.id,
          userId: owner.id,
          role: PrismaHouseholdRole.Owner,
          status: PrismaMembershipStatus.Active,
        },
      });

      await databaseTransaction.auditEvent.create({
        data: {
          action: 'household.created',
          actorUserId: owner.id,
          householdId: household.id,
          resourceId: household.id,
          result: AUDIT_RESULT_SUCCEEDED,
        },
      });

      return {
        household: toHouseholdRecord(household),
        membership: toMembershipRecord(membership),
      };
    });
  }

  async findActiveForUser(userId: string): Promise<UserHousehold[]> {
    const memberships = await this.prisma.householdMembership.findMany({
      where: {
        userId,
        status: PrismaMembershipStatus.Active,
        user: { status: PrismaUserStatus.Active },
      },
      include: { household: true },
      orderBy: [{ household: { name: 'asc' } }, { householdId: 'asc' }],
    });

    return memberships.map((membership) => ({
      household: toHouseholdRecord(membership.household),
      membership: toMembershipRecord(membership),
    }));
  }

  async findActiveMembership(
    scope: ActiveMembershipScope,
  ): Promise<HouseholdMembershipRecord | null> {
    const membership = await this.prisma.householdMembership.findFirst({
      where: {
        householdId: scope.householdId,
        userId: scope.userId,
        status: PrismaMembershipStatus.Active,
        user: { status: PrismaUserStatus.Active },
      },
    });

    return membership === null ? null : toMembershipRecord(membership);
  }

  async findActiveForUserAndHousehold(scope: ActiveMembershipScope): Promise<UserHousehold | null> {
    const membership = await this.prisma.householdMembership.findFirst({
      where: {
        householdId: scope.householdId,
        userId: scope.userId,
        status: PrismaMembershipStatus.Active,
        user: { status: PrismaUserStatus.Active },
      },
      include: { household: true },
    });

    return membership === null
      ? null
      : {
          household: toHouseholdRecord(membership.household),
          membership: toMembershipRecord(membership),
        };
  }
}
