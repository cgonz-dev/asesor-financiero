import type { HouseholdInvitationStatus } from '@copiloto/contracts';

import type { HouseholdInvitationRecord } from './household-invitation-repository';

export function householdInvitationStatus(
  invitation: HouseholdInvitationRecord,
  now: Date,
): HouseholdInvitationStatus {
  if (invitation.acceptedAt !== null) {
    return 'accepted';
  }

  if (invitation.revokedAt !== null) {
    return 'revoked';
  }

  return now.getTime() >= invitation.expiresAt.getTime() ? 'expired' : 'pending';
}
