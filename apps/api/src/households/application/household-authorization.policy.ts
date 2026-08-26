import { HouseholdMembershipStatus, HouseholdRole } from '@copiloto/domain';
import { Injectable } from '@nestjs/common';

import type { HouseholdMembershipRecord } from './household-repository';

export const HouseholdCapability = {
  ManageInvitations: 'manageInvitations',
  ViewBasicConfiguration: 'viewBasicConfiguration',
  ViewMembers: 'viewMembers',
} as const;

export type HouseholdCapability = (typeof HouseholdCapability)[keyof typeof HouseholdCapability];

@Injectable()
export class HouseholdAuthorizationPolicy {
  allows(membership: HouseholdMembershipRecord, capability: string): boolean {
    if (membership.status !== HouseholdMembershipStatus.Active) {
      return false;
    }

    switch (capability) {
      case HouseholdCapability.ManageInvitations:
        return membership.role === HouseholdRole.Owner;
      case HouseholdCapability.ViewBasicConfiguration:
      case HouseholdCapability.ViewMembers:
        return membership.role === HouseholdRole.Owner || membership.role === HouseholdRole.Member;
      default:
        return false;
    }
  }
}
