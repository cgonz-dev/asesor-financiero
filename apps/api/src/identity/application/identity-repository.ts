import type { UserStatusValue, VerifiedExternalIdentity } from '@copiloto/domain';

export interface InternalUser {
  id: string;
  status: UserStatusValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface IdentityRepository {
  resolveOrCreate(identity: VerifiedExternalIdentity): Promise<InternalUser>;
}

export const IDENTITY_REPOSITORY = Symbol('IDENTITY_REPOSITORY');
