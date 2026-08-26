export interface HouseholdInvitationClock {
  now(): Date;
}

export const HOUSEHOLD_INVITATION_CLOCK = Symbol('HOUSEHOLD_INVITATION_CLOCK');

export const SYSTEM_HOUSEHOLD_INVITATION_CLOCK: HouseholdInvitationClock = {
  now: () => new Date(),
};
