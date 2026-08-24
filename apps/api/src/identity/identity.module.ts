import { Module } from '@nestjs/common';

import { IDENTITY_REPOSITORY } from './application/identity-repository';
import { ResolveOrCreateUserFromExternalIdentity } from './application/resolve-or-create-user-from-external-identity';
import { PrismaIdentityRepository } from './infrastructure/prisma-identity.repository';

@Module({
  providers: [
    PrismaIdentityRepository,
    {
      provide: IDENTITY_REPOSITORY,
      useExisting: PrismaIdentityRepository,
    },
    ResolveOrCreateUserFromExternalIdentity,
  ],
  exports: [ResolveOrCreateUserFromExternalIdentity],
})
export class IdentityModule {}
