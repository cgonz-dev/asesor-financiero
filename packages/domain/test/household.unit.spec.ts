import {
  DomainValidationError,
  HouseholdMembershipStatus,
  HouseholdRole,
  MAX_HOUSEHOLD_NAME_LENGTH,
  householdName,
  initialOwnerMembership,
  invitationEmailMatches,
  invitationTargetEmail,
} from '@copiloto/domain';
import { describe, expect, it } from 'vitest';

describe('Household rules', () => {
  it('creates only an active Owner as the initial membership', () => {
    expect(initialOwnerMembership('018f85d7-6b2a-7f25-bfd0-554a23d4b65a')).toEqual({
      userId: '018f85d7-6b2a-7f25-bfd0-554a23d4b65a',
      role: HouseholdRole.Owner,
      status: HouseholdMembershipStatus.Active,
    });
  });

  it('normalizes a non-empty Household name', () => {
    expect(householdName('  Hogar piloto  ')).toBe('Hogar piloto');
  });

  it('rejects an empty Household name', () => {
    expect(() => householdName('   ')).toThrow(DomainValidationError);
  });

  it('rejects a Household name beyond the bounded domain limit', () => {
    expect(() => householdName('H'.repeat(MAX_HOUSEHOLD_NAME_LENGTH + 1))).toThrow(
      'Household name must not exceed 100 characters.',
    );
  });

  it('normalizes an invitation delivery email without using it as User identity', () => {
    expect(invitationTargetEmail('  Partner@Example.Test ')).toBe('partner@example.test');
    expect(() => invitationTargetEmail('not-an-email')).toThrow(DomainValidationError);
  });

  it('matches an invitation only to a server-verified normalized email', () => {
    expect(invitationEmailMatches('partner@example.test', 'PARTNER@example.test', true)).toBe(true);
    expect(invitationEmailMatches('partner@example.test', 'other@example.test', true)).toBe(false);
    expect(invitationEmailMatches('partner@example.test', 'partner@example.test', false)).toBe(
      false,
    );
    expect(invitationEmailMatches('partner@example.test', undefined, undefined)).toBe(false);
  });
});
