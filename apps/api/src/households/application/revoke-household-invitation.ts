import { Inject, Injectable } from '@nestjs/common';

import type { HouseholdInvitationView } from './create-household-invitation';
import {
  HOUSEHOLD_INVITATION_CLOCK,
  type HouseholdInvitationClock,
} from './household-invitation-clock';
import {
  HOUSEHOLD_INVITATION_REPOSITORY,
  type HouseholdInvitationRepository,
} from './household-invitation-repository';
import { householdInvitationStatus } from './household-invitation-status';
import { HouseholdCapability } from './household-authorization.policy';
import { HouseholdContextResolver } from './household-context-resolver';

@Injectable()
export class RevokeHouseholdInvitation {
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
    invitationId: string;
  }): Promise<HouseholdInvitationView> {
    const context = await this.contextResolver.resolve({
      capability: HouseholdCapability.ManageInvitations,
      householdId: input.householdId,
      internalUserId: input.internalUserId,
    });
    const now = this.clock.now();
    const invitation = await this.repository.revoke({
      actorMembershipId: context.membership.id,
      actorUserId: input.internalUserId,
      householdId: context.household.id,
      invitationId: input.invitationId,
      now,
    });

    return { invitation, status: householdInvitationStatus(invitation, now) };
  }
}
