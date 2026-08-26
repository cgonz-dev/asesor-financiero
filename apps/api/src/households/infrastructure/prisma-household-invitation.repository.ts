import { HouseholdMembershipStatus, HouseholdRole, invitationEmailMatches } from '@copiloto/domain';
import { Inject, Injectable } from '@nestjs/common';

import {
  HouseholdMembershipStatus as PrismaMembershipStatus,
  HouseholdRole as PrismaHouseholdRole,
  type Prisma,
  UserStatus as PrismaUserStatus,
} from '../../generated/prisma/client';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import {
  HouseholdForbiddenError,
  HouseholdInvitationNotFoundError,
  HouseholdInvitationUnavailableError,
  HouseholdNotFoundError,
} from '../application/errors';
import type {
  AcceptInvitationRecordInput,
  AcceptInvitationRecordResult,
  CreateInvitationRecordInput,
  HouseholdInvitationRecord,
  HouseholdInvitationRepository,
  RevokeInvitationRecordInput,
} from '../application/household-invitation-repository';
import type {
  HouseholdMembershipRecord,
  HouseholdRecord,
  UserHousehold,
} from '../application/household-repository';

const AUDIT_RESULT_SUCCEEDED = 'succeeded';

type DatabaseTransaction = Prisma.TransactionClient;

interface LockedInvitationRow {
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  createdAt: Date;
  createdByMembershipId: string;
  expiresAt: Date;
  householdId: string;
  id: string;
  revokedAt: Date | null;
  targetEmail: string;
}

function toInvitationRecord(invitation: LockedInvitationRow): HouseholdInvitationRecord {
  return invitation;
}

function toHouseholdRecord(household: {
  createdAt: Date;
  id: string;
  name: string;
  updatedAt: Date;
}): HouseholdRecord {
  return household;
}

function toMembershipRecord(membership: {
  createdAt: Date;
  householdId: string;
  id: string;
  role: PrismaHouseholdRole;
  status: PrismaMembershipStatus;
  updatedAt: Date;
  userId: string;
}): HouseholdMembershipRecord {
  const status = {
    [PrismaMembershipStatus.Active]: HouseholdMembershipStatus.Active,
    [PrismaMembershipStatus.Left]: HouseholdMembershipStatus.Left,
    [PrismaMembershipStatus.Removed]: HouseholdMembershipStatus.Removed,
    [PrismaMembershipStatus.Suspended]: HouseholdMembershipStatus.Suspended,
  }[membership.status];

  return {
    ...membership,
    role:
      membership.role === PrismaHouseholdRole.Owner ? HouseholdRole.Owner : HouseholdRole.Member,
    status,
  };
}

@Injectable()
export class PrismaHouseholdInvitationRepository implements HouseholdInvitationRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async create(input: CreateInvitationRecordInput): Promise<HouseholdInvitationRecord> {
    return this.prisma.$transaction(async (databaseTransaction) => {
      await this.requireActiveOwner(databaseTransaction, input);
      const invitation = await databaseTransaction.householdInvitation.create({
        data: {
          createdAt: input.createdAt,
          createdByMembershipId: input.actorMembershipId,
          expiresAt: input.expiresAt,
          householdId: input.householdId,
          targetEmail: input.targetEmail,
          tokenHash: Uint8Array.from(input.tokenHash),
        },
        select: this.invitationSelection(),
      });
      await this.audit(databaseTransaction, {
        action: 'invitation.created',
        actorUserId: input.actorUserId,
        createdAt: input.createdAt,
        householdId: input.householdId,
        resourceId: invitation.id,
      });

      return toInvitationRecord(invitation);
    });
  }

  async listForHousehold(householdId: string): Promise<HouseholdInvitationRecord[]> {
    const invitations = await this.prisma.householdInvitation.findMany({
      where: { householdId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: this.invitationSelection(),
    });

    return invitations.map(toInvitationRecord);
  }

  async listMembers(householdId: string): Promise<HouseholdMembershipRecord[]> {
    const memberships = await this.prisma.householdMembership.findMany({
      where: {
        householdId,
        status: PrismaMembershipStatus.Active,
        user: { status: PrismaUserStatus.Active },
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    });

    return memberships.map(toMembershipRecord);
  }

  async revoke(input: RevokeInvitationRecordInput): Promise<HouseholdInvitationRecord> {
    return this.prisma.$transaction(async (databaseTransaction) => {
      await this.requireActiveOwner(databaseTransaction, input);
      const invitation = await this.lockInvitationById(
        databaseTransaction,
        input.householdId,
        input.invitationId,
      );

      if (invitation === null) {
        throw new HouseholdInvitationNotFoundError();
      }

      if (invitation.acceptedAt !== null || input.now.getTime() >= invitation.expiresAt.getTime()) {
        throw new HouseholdInvitationUnavailableError();
      }

      if (invitation.revokedAt !== null) {
        return toInvitationRecord(invitation);
      }

      const revoked = await databaseTransaction.householdInvitation.update({
        where: { id: invitation.id },
        data: { revokedAt: input.now },
        select: this.invitationSelection(),
      });
      await this.audit(databaseTransaction, {
        action: 'invitation.revoked',
        actorUserId: input.actorUserId,
        createdAt: input.now,
        householdId: input.householdId,
        resourceId: invitation.id,
      });

      return toInvitationRecord(revoked);
    });
  }

  async accept(input: AcceptInvitationRecordInput): Promise<AcceptInvitationRecordResult> {
    return this.prisma.$transaction(async (databaseTransaction) => {
      const invitation = await this.lockInvitationByHash(databaseTransaction, input.tokenHash);

      if (invitation === null) {
        throw new HouseholdInvitationUnavailableError();
      }

      const existingMembership = await databaseTransaction.householdMembership.findUnique({
        where: {
          householdId_userId: {
            householdId: invitation.householdId,
            userId: input.internalUserId,
          },
        },
      });

      if (invitation.acceptedAt !== null) {
        if (
          invitation.acceptedByUserId === input.internalUserId &&
          existingMembership?.status === PrismaMembershipStatus.Active
        ) {
          return {
            context: await this.userHousehold(
              databaseTransaction,
              invitation.householdId,
              existingMembership,
            ),
            repeated: true,
          };
        }

        throw new HouseholdInvitationUnavailableError();
      }

      if (
        invitation.revokedAt !== null ||
        input.now.getTime() >= invitation.expiresAt.getTime() ||
        !invitationEmailMatches(
          invitation.targetEmail,
          input.authenticatedEmail,
          input.authenticatedEmailVerified,
        )
      ) {
        throw new HouseholdInvitationUnavailableError();
      }

      if (
        existingMembership !== null &&
        existingMembership.status !== PrismaMembershipStatus.Active
      ) {
        throw new HouseholdInvitationUnavailableError();
      }

      const activeUser = await databaseTransaction.user.findFirst({
        where: { id: input.internalUserId, status: PrismaUserStatus.Active },
        select: { id: true },
      });

      if (activeUser === null) {
        throw new HouseholdInvitationUnavailableError();
      }

      const membership =
        existingMembership ??
        (await databaseTransaction.householdMembership.create({
          data: {
            householdId: invitation.householdId,
            role: PrismaHouseholdRole.Member,
            status: PrismaMembershipStatus.Active,
            userId: input.internalUserId,
          },
        }));

      await databaseTransaction.householdInvitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: input.now,
          acceptedByUserId: input.internalUserId,
        },
      });
      await this.audit(databaseTransaction, {
        action: 'invitation.accepted',
        actorUserId: input.internalUserId,
        createdAt: input.now,
        householdId: invitation.householdId,
        resourceId: invitation.id,
      });

      return {
        context: await this.userHousehold(databaseTransaction, invitation.householdId, membership),
        repeated: false,
      };
    });
  }

  private invitationSelection() {
    return {
      acceptedAt: true,
      acceptedByUserId: true,
      createdAt: true,
      createdByMembershipId: true,
      expiresAt: true,
      householdId: true,
      id: true,
      revokedAt: true,
      targetEmail: true,
    } as const;
  }

  private async requireActiveOwner(
    databaseTransaction: DatabaseTransaction,
    input: { actorMembershipId: string; actorUserId: string; householdId: string },
  ): Promise<void> {
    const membership = await databaseTransaction.householdMembership.findUnique({
      where: {
        id_householdId: {
          householdId: input.householdId,
          id: input.actorMembershipId,
        },
      },
    });

    if (
      membership === null ||
      membership.userId !== input.actorUserId ||
      membership.status !== PrismaMembershipStatus.Active
    ) {
      throw new HouseholdNotFoundError();
    }

    if (membership.role !== PrismaHouseholdRole.Owner) {
      throw new HouseholdForbiddenError();
    }
  }

  private async lockInvitationById(
    databaseTransaction: DatabaseTransaction,
    householdId: string,
    invitationId: string,
  ): Promise<LockedInvitationRow | null> {
    const rows = await databaseTransaction.$queryRaw<LockedInvitationRow[]>`
      SELECT
        "id",
        "household_id" AS "householdId",
        "created_by_membership_id" AS "createdByMembershipId",
        "target_email" AS "targetEmail",
        "expires_at" AS "expiresAt",
        "created_at" AS "createdAt",
        "revoked_at" AS "revokedAt",
        "accepted_at" AS "acceptedAt",
        "accepted_by_user_id" AS "acceptedByUserId"
      FROM "household_invitation"
      WHERE "household_id" = CAST(${householdId} AS uuid)
        AND "id" = CAST(${invitationId} AS uuid)
      FOR UPDATE
    `;

    return rows[0] ?? null;
  }

  private async lockInvitationByHash(
    databaseTransaction: DatabaseTransaction,
    tokenHash: Uint8Array,
  ): Promise<LockedInvitationRow | null> {
    const rows = await databaseTransaction.$queryRaw<LockedInvitationRow[]>`
      SELECT
        "id",
        "household_id" AS "householdId",
        "created_by_membership_id" AS "createdByMembershipId",
        "target_email" AS "targetEmail",
        "expires_at" AS "expiresAt",
        "created_at" AS "createdAt",
        "revoked_at" AS "revokedAt",
        "accepted_at" AS "acceptedAt",
        "accepted_by_user_id" AS "acceptedByUserId"
      FROM "household_invitation"
      WHERE "token_hash" = ${Uint8Array.from(tokenHash)}
      FOR UPDATE
    `;

    return rows[0] ?? null;
  }

  private async userHousehold(
    databaseTransaction: DatabaseTransaction,
    householdId: string,
    membership: {
      createdAt: Date;
      householdId: string;
      id: string;
      role: PrismaHouseholdRole;
      status: PrismaMembershipStatus;
      updatedAt: Date;
      userId: string;
    },
  ): Promise<UserHousehold> {
    const household = await databaseTransaction.household.findUniqueOrThrow({
      where: { id: householdId },
    });

    return {
      household: toHouseholdRecord(household),
      membership: toMembershipRecord(membership),
    };
  }

  private async audit(
    databaseTransaction: DatabaseTransaction,
    input: {
      action: string;
      actorUserId: string;
      createdAt: Date;
      householdId: string;
      resourceId: string;
    },
  ): Promise<void> {
    await databaseTransaction.auditEvent.create({
      data: {
        ...input,
        result: AUDIT_RESULT_SUCCEEDED,
      },
    });
  }
}
