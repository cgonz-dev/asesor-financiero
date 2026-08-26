import type { HouseholdMembershipRecord, UserHousehold } from './household-repository';

export interface HouseholdInvitationRecord {
  acceptedAt: Date | null;
  acceptedByUserId: string | null;
  createdAt: Date;
  createdByMembershipId: string;
  expiresAt: Date;
  householdId: string;
  id: string;
  revokedAt: Date | null;
  targetEmail: string;
}

export interface CreateInvitationRecordInput {
  actorMembershipId: string;
  actorUserId: string;
  createdAt: Date;
  expiresAt: Date;
  householdId: string;
  targetEmail: string;
  tokenHash: Uint8Array;
}

export interface RevokeInvitationRecordInput {
  actorMembershipId: string;
  actorUserId: string;
  householdId: string;
  invitationId: string;
  now: Date;
}

export interface AcceptInvitationRecordInput {
  authenticatedEmail: string | undefined;
  authenticatedEmailVerified: boolean | undefined;
  internalUserId: string;
  now: Date;
  tokenHash: Uint8Array;
}

export interface AcceptInvitationRecordResult {
  context: UserHousehold;
  repeated: boolean;
}

export interface HouseholdInvitationRepository {
  accept(input: AcceptInvitationRecordInput): Promise<AcceptInvitationRecordResult>;
  create(input: CreateInvitationRecordInput): Promise<HouseholdInvitationRecord>;
  listForHousehold(householdId: string): Promise<HouseholdInvitationRecord[]>;
  listMembers(householdId: string): Promise<HouseholdMembershipRecord[]>;
  revoke(input: RevokeInvitationRecordInput): Promise<HouseholdInvitationRecord>;
}

export const HOUSEHOLD_INVITATION_REPOSITORY = Symbol('HOUSEHOLD_INVITATION_REPOSITORY');
