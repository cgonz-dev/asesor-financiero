export class ActiveInternalUserRequiredError extends Error {
  constructor() {
    super('An active internal User is required for this operation.');
    this.name = 'ActiveInternalUserRequiredError';
  }
}
