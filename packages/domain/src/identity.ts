import { DomainValidationError } from './errors';

export const UserStatus = {
  Active: 'active',
  Blocked: 'blocked',
} as const;

export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export interface VerifiedExternalIdentity {
  issuer: string;
  subject: string;
  provider: string;
  email?: string;
  emailVerified?: boolean;
}

function requireExactNonEmpty(value: string, field: string): string {
  if (value.length === 0 || value.trim() !== value) {
    throw new DomainValidationError(
      `${field} must be non-empty and must not contain outer whitespace.`,
    );
  }

  return value;
}

/**
 * Validates only the shape of claims already verified by a trusted adapter.
 * It does not verify a JWT, issuer, signature, audience or login request.
 */
export function verifiedExternalIdentity(
  input: VerifiedExternalIdentity,
): VerifiedExternalIdentity {
  const issuer = requireExactNonEmpty(input.issuer, 'issuer');
  const subject = requireExactNonEmpty(input.subject, 'subject');
  const provider = requireExactNonEmpty(input.provider, 'provider');

  if (input.email === undefined && input.emailVerified !== undefined) {
    throw new DomainValidationError('emailVerified cannot be supplied without email.');
  }

  if (input.email !== undefined) {
    requireExactNonEmpty(input.email, 'email');
  }

  return {
    issuer,
    subject,
    provider,
    ...(input.email === undefined ? {} : { email: input.email }),
    ...(input.emailVerified === undefined ? {} : { emailVerified: input.emailVerified }),
  };
}
