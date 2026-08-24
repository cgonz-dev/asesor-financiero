import type { HouseholdMembershipStatusValue, HouseholdRoleValue } from '@copiloto/domain';

export interface HouseholdRecord {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseholdMembershipRecord {
  id: string;
  householdId: string;
  userId: string;
  role: HouseholdRoleValue;
  status: HouseholdMembershipStatusValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserHousehold {
  household: HouseholdRecord;
  membership: HouseholdMembershipRecord;
}

export interface CreateHouseholdWithInitialOwnerInput {
  name: string;
  ownerUserId: string;
  ownerRole: HouseholdRoleValue;
  membershipStatus: HouseholdMembershipStatusValue;
}

export interface ActiveMembershipScope {
  householdId: string;
  userId: string;
}

export interface HouseholdRepository {
  createWithInitialOwner(input: CreateHouseholdWithInitialOwnerInput): Promise<UserHousehold>;
  findActiveForUser(userId: string): Promise<UserHousehold[]>;
  findActiveMembership(scope: ActiveMembershipScope): Promise<HouseholdMembershipRecord | null>;
}

export const HOUSEHOLD_REPOSITORY = Symbol('HOUSEHOLD_REPOSITORY');
