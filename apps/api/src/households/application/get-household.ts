import { Inject, Injectable } from '@nestjs/common';

import { HouseholdCapability } from './household-authorization.policy';
import { HouseholdContextResolver } from './household-context-resolver';
import type { UserHousehold } from './household-repository';

export interface GetHouseholdInput {
  householdId: string;
  internalUserId: string;
}

@Injectable()
export class GetHousehold {
  constructor(
    @Inject(HouseholdContextResolver)
    private readonly contextResolver: HouseholdContextResolver,
  ) {}

  execute(input: GetHouseholdInput): Promise<UserHousehold> {
    return this.contextResolver.resolve({
      capability: HouseholdCapability.ViewBasicConfiguration,
      householdId: input.householdId,
      internalUserId: input.internalUserId,
    });
  }
}
