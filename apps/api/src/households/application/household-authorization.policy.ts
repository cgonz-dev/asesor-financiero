import {
  HouseholdCapability as DomainHouseholdCapability,
  allowsHouseholdCapability,
  type HouseholdCapabilityValue,
} from '@copiloto/domain';
import { Injectable } from '@nestjs/common';

import type { HouseholdMembershipRecord } from './household-repository';

export const HouseholdCapability = DomainHouseholdCapability;
export type HouseholdCapability = HouseholdCapabilityValue;

@Injectable()
export class HouseholdAuthorizationPolicy {
  allows(membership: HouseholdMembershipRecord, capability: string): boolean {
    return allowsHouseholdCapability(membership, capability);
  }
}
