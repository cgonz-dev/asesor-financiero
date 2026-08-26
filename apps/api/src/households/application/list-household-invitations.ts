import { Inject, Injectable } from '@nestjs/common';

import {
  HOUSEHOLD_INVITATION_CLOCK,
  type HouseholdInvitationClock,
} from './household-invitation-clock';
import {
  HOUSEHOLD_INVITATION_REPOSITORY,
  type HouseholdInvitationRepository,
} from './household-invitation-repository';
import { householdInvitationStatus } from './household-invitation-status';
import type { HouseholdInvitationView } from './create-household-invitation';
import { HouseholdCapability } from './household-authorization.policy';
import { HouseholdContextResolver } from './household-context-resolver';

@Injectable()
export class ListHouseholdInvitations {
  constructor(
    @Inject(HouseholdContextResolver)
    private readonly contextResolver: HouseholdContextResolver,
    @Inject(HOUSEHOLD_INVITATION_REPOSITORY)
    private readonly repository: HouseholdInvitationRepository,
    @Inject(HOUSEHOLD_INVITATION_CLOCK)
    private readonly clock: HouseholdInvitationClock,
  ) {}

  async execute(input: {
    householdId: string;
    internalUserId: string;
  }): Promise<HouseholdInvitationView[]> {
    const context = await this.contextResolver.resolve({
      capability: HouseholdCapability.ManageInvitations,
      householdId: input.householdId,
      internalUserId: input.internalUserId,
    });
    const now = this.clock.now();
    const invitations = await this.repository.listForHousehold(context.household.id);

    return invitations.map((invitation) => ({
      invitation,
      status: householdInvitationStatus(invitation, now),
    }));
  }
}
