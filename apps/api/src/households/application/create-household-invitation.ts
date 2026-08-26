import { invitationTargetEmail } from '@copiloto/domain';
import { Inject, Injectable } from '@nestjs/common';

import {
  HOUSEHOLD_INVITATION_CLOCK,
  type HouseholdInvitationClock,
} from './household-invitation-clock';
import {
  HOUSEHOLD_INVITATION_CONFIGURATION,
  type HouseholdInvitationConfiguration,
} from './household-invitation-configuration';
import {
  HOUSEHOLD_INVITATION_REPOSITORY,
  type HouseholdInvitationRecord,
  type HouseholdInvitationRepository,
} from './household-invitation-repository';
import { householdInvitationStatus } from './household-invitation-status';
import {
  HOUSEHOLD_INVITATION_TOKEN_SERVICE,
  type HouseholdInvitationTokenService,
} from './household-invitation-token';
import { HouseholdCapability } from './household-authorization.policy';
import { HouseholdContextResolver } from './household-context-resolver';

export interface CreateHouseholdInvitationInput {
  householdId: string;
  internalUserId: string;
  targetEmail: string;
}

export interface HouseholdInvitationView {
  invitation: HouseholdInvitationRecord;
  status: 'accepted' | 'expired' | 'pending' | 'revoked';
}

export interface CreatedHouseholdInvitation extends HouseholdInvitationView {
  rawToken: string;
}

@Injectable()
export class CreateHouseholdInvitation {
  constructor(
    @Inject(HouseholdContextResolver)
    private readonly contextResolver: HouseholdContextResolver,
    @Inject(HOUSEHOLD_INVITATION_REPOSITORY)
    private readonly repository: HouseholdInvitationRepository,
    @Inject(HOUSEHOLD_INVITATION_TOKEN_SERVICE)
    private readonly tokenService: HouseholdInvitationTokenService,
    @Inject(HOUSEHOLD_INVITATION_CLOCK)
    private readonly clock: HouseholdInvitationClock,
    @Inject(HOUSEHOLD_INVITATION_CONFIGURATION)
    private readonly configuration: HouseholdInvitationConfiguration,
  ) {}

  async execute(input: CreateHouseholdInvitationInput): Promise<CreatedHouseholdInvitation> {
    const context = await this.contextResolver.resolve({
      capability: HouseholdCapability.ManageInvitations,
      householdId: input.householdId,
      internalUserId: input.internalUserId,
    });
    const now = this.clock.now();
    const generated = this.tokenService.generate();
    const invitation = await this.repository.create({
      actorMembershipId: context.membership.id,
      actorUserId: input.internalUserId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.configuration.ttlMs),
      householdId: context.household.id,
      targetEmail: invitationTargetEmail(input.targetEmail),
      tokenHash: generated.tokenHash,
    });

    return {
      invitation,
      rawToken: generated.rawToken,
      status: householdInvitationStatus(invitation, now),
    };
  }
}
