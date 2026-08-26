import { Inject, Injectable } from '@nestjs/common';

import {
  HOUSEHOLD_INVITATION_REPOSITORY,
  type HouseholdInvitationRepository,
} from './household-invitation-repository';
import { HouseholdCapability } from './household-authorization.policy';
import { HouseholdContextResolver } from './household-context-resolver';
import type { HouseholdMembershipRecord } from './household-repository';

@Injectable()
export class ListHouseholdMembers {
  constructor(
    @Inject(HouseholdContextResolver)
    private readonly contextResolver: HouseholdContextResolver,
    @Inject(HOUSEHOLD_INVITATION_REPOSITORY)
    private readonly repository: HouseholdInvitationRepository,
  ) {}

  async execute(input: {
    householdId: string;
    internalUserId: string;
  }): Promise<HouseholdMembershipRecord[]> {
    const context = await this.contextResolver.resolve({
      capability: HouseholdCapability.ViewMembers,
      householdId: input.householdId,
      internalUserId: input.internalUserId,
    });

    return this.repository.listMembers(context.household.id);
  }
}
