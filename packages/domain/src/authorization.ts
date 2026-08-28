import {
  HouseholdMembershipStatus,
  HouseholdRole,
  type HouseholdMembershipStatus as HouseholdMembershipStatusValue,
  type HouseholdRole as HouseholdRoleValue,
} from './household';

export const HouseholdCapability = {
  ManageInvitations: 'manageInvitations',
  ViewBasicConfiguration: 'viewBasicConfiguration',
  ViewMembers: 'viewMembers',
} as const;

export type HouseholdCapability = (typeof HouseholdCapability)[keyof typeof HouseholdCapability];

export interface HouseholdCapabilityMembership {
  role: HouseholdRoleValue;
  status: HouseholdMembershipStatusValue;
}

export function allowsHouseholdCapability(
  membership: HouseholdCapabilityMembership,
  capability: string,
): boolean {
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

export const ResourceAction = {
  View: 'view',
} as const;

export type ResourceAction = (typeof ResourceAction)[keyof typeof ResourceAction];

export const ResourceVisibility = {
  Household: 'household',
  Private: 'private',
  SelectedMembers: 'selectedMembers',
} as const;

export type ResourceVisibility = (typeof ResourceVisibility)[keyof typeof ResourceVisibility];

export interface ResourceActorMembership {
  householdId: string;
  membershipId: string;
  role: HouseholdRoleValue;
  status: HouseholdMembershipStatusValue;
  userId: string;
}

export interface ProtectedHouseholdResource {
  householdId: string;
  ownerUserId: string | null;
  selectedMembershipIds: readonly string[];
  visibility: ResourceVisibility;
}

export interface ResourceAuthorizationInput {
  action: string;
  actor: ResourceActorMembership;
  hasRequiredCapability: boolean;
  resource: ProtectedHouseholdResource;
}

export function allowsResourceAction(input: ResourceAuthorizationInput): boolean {
  if (
    input.action !== ResourceAction.View ||
    !input.hasRequiredCapability ||
    input.actor.status !== HouseholdMembershipStatus.Active ||
    (input.actor.role !== HouseholdRole.Owner && input.actor.role !== HouseholdRole.Member) ||
    input.actor.householdId !== input.resource.householdId
  ) {
    return false;
  }

  switch (input.resource.visibility) {
    case ResourceVisibility.Private:
      return input.resource.ownerUserId === input.actor.userId;
    case ResourceVisibility.SelectedMembers:
      return (
        input.resource.ownerUserId === input.actor.userId ||
        input.resource.selectedMembershipIds.includes(input.actor.membershipId)
      );
    case ResourceVisibility.Household:
      return true;
    default:
      return false;
  }
}
