import {
  DomainValidationError,
  HouseholdMembershipStatus,
  HouseholdRole,
  householdName,
  initialOwnerMembership,
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
});
