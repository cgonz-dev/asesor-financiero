import { Inject, Injectable } from '@nestjs/common';

import { HouseholdForbiddenError, HouseholdNotFoundError } from './errors';
import type { HouseholdCapability } from './household-authorization.policy';
import { HouseholdAuthorizationPolicy } from './household-authorization.policy';
import {
  HOUSEHOLD_REPOSITORY,
  type HouseholdRepository,
  type UserHousehold,
} from './household-repository';

export interface ResolveHouseholdContextInput {
  capability: HouseholdCapability;
  householdId: string;
  internalUserId: string;
}

@Injectable()
export class HouseholdContextResolver {
  constructor(
    @Inject(HOUSEHOLD_REPOSITORY)
    private readonly householdRepository: HouseholdRepository,
    @Inject(HouseholdAuthorizationPolicy)
    private readonly policy: HouseholdAuthorizationPolicy,
  ) {}

  async resolve(input: ResolveHouseholdContextInput): Promise<UserHousehold> {
    const context = await this.householdRepository.findActiveForUserAndHousehold({
      householdId: input.householdId,
      userId: input.internalUserId,
    });

    if (context === null) {
      throw new HouseholdNotFoundError();
    }

    if (!this.policy.allows(context.membership, input.capability)) {
      throw new HouseholdForbiddenError();
    }

    return context;
  }
}
