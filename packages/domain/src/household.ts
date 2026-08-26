import { DomainValidationError } from './errors';

export const MAX_HOUSEHOLD_NAME_LENGTH = 100;
export const MAX_INVITATION_TARGET_EMAIL_LENGTH = 320;

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

  if (normalized.length > MAX_HOUSEHOLD_NAME_LENGTH) {
    throw new DomainValidationError('Household name must not exceed 100 characters.');
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

export function invitationTargetEmail(value: string): string {
  const normalized = value.trim().toLowerCase();

  if (
    normalized.length === 0 ||
    normalized.length > MAX_INVITATION_TARGET_EMAIL_LENGTH ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new DomainValidationError('Invitation target email is invalid.');
  }

  return normalized;
}

export function invitationEmailMatches(
  targetEmail: string,
  authenticatedEmail: string | undefined,
  emailVerified: boolean | undefined,
): boolean {
  return (
    emailVerified === true &&
    authenticatedEmail !== undefined &&
    invitationTargetEmail(authenticatedEmail) === invitationTargetEmail(targetEmail)
  );
}
