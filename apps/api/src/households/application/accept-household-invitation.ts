import { invitationTargetEmail } from '@copiloto/domain';
import { Inject, Injectable } from '@nestjs/common';

import {
  HOUSEHOLD_INVITATION_CLOCK,
  type HouseholdInvitationClock,
} from './household-invitation-clock';
import {
  HOUSEHOLD_INVITATION_REPOSITORY,
  type AcceptInvitationRecordResult,
  type HouseholdInvitationRepository,
} from './household-invitation-repository';
import {
  HOUSEHOLD_INVITATION_TOKEN_SERVICE,
  type HouseholdInvitationTokenService,
} from './household-invitation-token';

@Injectable()
export class AcceptHouseholdInvitation {
  constructor(
    @Inject(HOUSEHOLD_INVITATION_REPOSITORY)
    private readonly repository: HouseholdInvitationRepository,
    @Inject(HOUSEHOLD_INVITATION_TOKEN_SERVICE)
    private readonly tokenService: HouseholdInvitationTokenService,
    @Inject(HOUSEHOLD_INVITATION_CLOCK)
    private readonly clock: HouseholdInvitationClock,
  ) {}

  execute(input: {
    authenticatedEmail: string | undefined;
    authenticatedEmailVerified: boolean | undefined;
    internalUserId: string;
    rawToken: string;
  }): Promise<AcceptInvitationRecordResult> {
    let normalizedEmail: string | undefined;

    if (input.authenticatedEmail !== undefined) {
      try {
        normalizedEmail = invitationTargetEmail(input.authenticatedEmail);
      } catch {
        normalizedEmail = undefined;
      }
    }

    return this.repository.accept({
      authenticatedEmail: normalizedEmail,
      authenticatedEmailVerified: input.authenticatedEmailVerified,
      internalUserId: input.internalUserId,
      now: this.clock.now(),
      tokenHash: this.tokenService.hash(input.rawToken),
    });
  }
}
