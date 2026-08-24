import { UserStatus, type VerifiedExternalIdentity } from '@copiloto/domain';
import { Inject, Injectable } from '@nestjs/common';

import { Prisma, UserStatus as PrismaUserStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../persistence/prisma/prisma.service';
import type { IdentityRepository, InternalUser } from '../application/identity-repository';

function toInternalUser(user: {
  id: string;
  status: PrismaUserStatus;
  createdAt: Date;
  updatedAt: Date;
}): InternalUser {
  return {
    id: user.id,
    status: user.status === PrismaUserStatus.Active ? UserStatus.Active : UserStatus.Blocked,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

@Injectable()
export class PrismaIdentityRepository implements IdentityRepository {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async resolveOrCreate(identity: VerifiedExternalIdentity): Promise<InternalUser> {
    const existing = await this.findByStableIdentity(identity.issuer, identity.subject);

    if (existing !== null) {
      return existing;
    }

    try {
      return await this.prisma.$transaction(async (databaseTransaction) => {
        const concurrentExisting = await databaseTransaction.externalIdentity.findUnique({
          where: {
            issuer_subject: {
              issuer: identity.issuer,
              subject: identity.subject,
            },
          },
          include: { user: true },
        });

        if (concurrentExisting !== null) {
          return toInternalUser(concurrentExisting.user);
        }

        const user = await databaseTransaction.user.create({
          data: {
            externalIdentities: {
              create: {
                issuer: identity.issuer,
                subject: identity.subject,
                provider: identity.provider,
                ...(identity.email === undefined ? {} : { email: identity.email }),
                ...(identity.emailVerified === undefined
                  ? {}
                  : { emailVerified: identity.emailVerified }),
              },
            },
          },
        });

        return toInternalUser(user);
      });
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        throw error;
      }

      const winner = await this.findByStableIdentity(identity.issuer, identity.subject);

      if (winner === null) {
        throw error;
      }

      return winner;
    }
  }

  private async findByStableIdentity(
    issuer: string,
    subject: string,
  ): Promise<InternalUser | null> {
    const identity = await this.prisma.externalIdentity.findUnique({
      where: {
        issuer_subject: { issuer, subject },
      },
      include: { user: true },
    });

    return identity === null ? null : toInternalUser(identity.user);
  }
}
