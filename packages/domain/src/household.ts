import { DomainValidationError } from './errors';

export const HouseholdRole = {
  Owner: 'owner',
  Member: 'member',
} as const;

export type HouseholdRole = (typeof HouseholdRole)[keyof typeof HouseholdRole];

export const HouseholdMembershipStatus = {
  Active: 'active',
  Suspended: 'suspended',
  Left: 'left',
  Removed: 'removed',
} as const;

export type HouseholdMembershipStatus =
  (typeof HouseholdMembershipStatus)[keyof typeof HouseholdMembershipStatus];

export interface InitialOwnerMembership {
  userId: string;
  role: typeof HouseholdRole.Owner;
  status: typeof HouseholdMembershipStatus.Active;
}

export function householdName(value: string): string {
  const normalized = value.trim();

  if (normalized.length === 0) {
    throw new DomainValidationError('Household name must not be empty.');
  }

  return normalized;
}

export function initialOwnerMembership(userId: string): InitialOwnerMembership {
  if (userId.length === 0 || userId.trim() !== userId) {
    throw new DomainValidationError('userId must be a non-empty opaque identifier.');
  }

  return {
    userId,
    role: HouseholdRole.Owner,
    status: HouseholdMembershipStatus.Active,
  };
}
