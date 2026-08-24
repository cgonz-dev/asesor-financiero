import { type VerifiedExternalIdentity, verifiedExternalIdentity } from '@copiloto/domain';
import { Inject, Injectable } from '@nestjs/common';

import {
  IDENTITY_REPOSITORY,
  type IdentityRepository,
  type InternalUser,
} from './identity-repository';

@Injectable()
export class ResolveOrCreateUserFromExternalIdentity {
  constructor(
    @Inject(IDENTITY_REPOSITORY)
    private readonly identityRepository: IdentityRepository,
  ) {}

  execute(identity: VerifiedExternalIdentity): Promise<InternalUser> {
    return this.identityRepository.resolveOrCreate(verifiedExternalIdentity(identity));
  }
}
