import { householdName, initialOwnerMembership } from '@copiloto/domain';
import { Inject, Injectable } from '@nestjs/common';

import {
  HOUSEHOLD_REPOSITORY,
  type HouseholdRepository,
  type UserHousehold,
} from './household-repository';

export interface CreateHouseholdInput {
  internalUserId: string;
  name: string;
}

@Injectable()
export class CreateHousehold {
  constructor(
    @Inject(HOUSEHOLD_REPOSITORY)
    private readonly householdRepository: HouseholdRepository,
  ) {}

  execute(input: CreateHouseholdInput): Promise<UserHousehold> {
    const owner = initialOwnerMembership(input.internalUserId);

    return this.householdRepository.createWithInitialOwner({
      name: householdName(input.name),
      ownerUserId: owner.userId,
      ownerRole: owner.role,
      membershipStatus: owner.status,
    });
  }
}
