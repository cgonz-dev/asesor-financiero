export class ActiveInternalUserRequiredError extends Error {
  constructor() {
    super('An active internal User is required for this operation.');
    this.name = 'ActiveInternalUserRequiredError';
  }
}

export class HouseholdNotFoundError extends Error {
  constructor() {
    super('The Household does not exist or is unavailable to the authenticated User.');
    this.name = 'HouseholdNotFoundError';
  }
}

export class HouseholdForbiddenError extends Error {
  constructor() {
    super('The authenticated User cannot perform this Household action.');
    this.name = 'HouseholdForbiddenError';
  }
}

export class HouseholdInvitationNotFoundError extends Error {
  constructor() {
    super('The Household invitation does not exist in the authorized Household.');
    this.name = 'HouseholdInvitationNotFoundError';
  }
}

export class HouseholdInvitationUnavailableError extends Error {
  constructor() {
    super('The Household invitation is invalid or unavailable.');
    this.name = 'HouseholdInvitationUnavailableError';
  }
}
