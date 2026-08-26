const DEFAULT_INVITATION_TTL_HOURS = 7 * 24;
const MIN_INVITATION_TTL_HOURS = 1;
const MAX_INVITATION_TTL_HOURS = 30 * 24;

export interface HouseholdInvitationConfiguration {
  ttlMs: number;
}

export const HOUSEHOLD_INVITATION_CONFIGURATION = Symbol('HOUSEHOLD_INVITATION_CONFIGURATION');

export function householdInvitationConfigurationFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): HouseholdInvitationConfiguration {
  const configured = environment.HOUSEHOLD_INVITATION_TTL_HOURS?.trim();
  const ttlHours =
    configured === undefined || configured.length === 0
      ? DEFAULT_INVITATION_TTL_HOURS
      : Number(configured);

  if (
    !Number.isInteger(ttlHours) ||
    ttlHours < MIN_INVITATION_TTL_HOURS ||
    ttlHours > MAX_INVITATION_TTL_HOURS
  ) {
    throw new Error('HOUSEHOLD_INVITATION_TTL_HOURS must be an integer from 1 through 720.');
  }

  return { ttlMs: ttlHours * 60 * 60 * 1_000 };
}
