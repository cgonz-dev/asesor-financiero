import { initialOwnerMembership } from '@copiloto/domain';
import { Inject, Injectable } from '@nestjs/common';

import {
  HOUSEHOLD_REPOSITORY,
  type HouseholdRepository,
  type UserHousehold,
} from './household-repository';

@Injectable()
export class ListUserHouseholds {
  constructor(
    @Inject(HOUSEHOLD_REPOSITORY)
    private readonly householdRepository: HouseholdRepository,
  ) {}

  execute(internalUserId: string): Promise<UserHousehold[]> {
    // The same opaque-ID rule applies; this use case receives the already resolved internal User.
    const { userId } = initialOwnerMembership(internalUserId);

    return this.householdRepository.findActiveForUser(userId);
  }
}
