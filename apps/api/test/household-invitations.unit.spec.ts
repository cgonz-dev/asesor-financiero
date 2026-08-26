import {
  HouseholdMembershipStatus,
  HouseholdRole,
  type HouseholdMembershipStatusValue,
} from '@copiloto/domain';
import { describe, expect, it } from 'vitest';

import { householdInvitationConfigurationFromEnvironment } from '../src/households/application/household-invitation-configuration';
import { householdInvitationStatus } from '../src/households/application/household-invitation-status';
import { NodeHouseholdInvitationTokenService } from '../src/households/application/household-invitation-token';
import {
  HouseholdAuthorizationPolicy,
  HouseholdCapability,
} from '../src/households/application/household-authorization.policy';
import type { HouseholdMembershipRecord } from '../src/households/application/household-repository';

const NOW = new Date('2026-08-25T18:00:00.000Z');

function membership(
  role: typeof HouseholdRole.Owner | typeof HouseholdRole.Member,
  status: HouseholdMembershipStatusValue = HouseholdMembershipStatus.Active,
): HouseholdMembershipRecord {
  return {
    createdAt: NOW,
    householdId: '22222222-2222-4222-8222-222222222222',
    id: '33333333-3333-4333-8333-333333333333',
    role,
    status,
    updatedAt: NOW,
    userId: '11111111-1111-4111-8111-111111111111',
  };
}

describe('Household invitation security primitives', () => {
  it('generates 256-bit opaque tokens and deterministic SHA-256 hashes', () => {
    const service = new NodeHouseholdInvitationTokenService();
    const first = service.generate();
    const second = service.generate();

    expect(first.rawToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.tokenHash).toHaveLength(32);
    expect(service.hash(first.rawToken)).toEqual(first.tokenHash);
    expect(second.rawToken).not.toBe(first.rawToken);
    expect(second.tokenHash).not.toEqual(first.tokenHash);
  });

  it('derives pending, expired, revoked and accepted states from trusted timestamps', () => {
    const invitation = {
      acceptedAt: null,
      acceptedByUserId: null,
      createdAt: NOW,
      createdByMembershipId: membership(HouseholdRole.Owner).id,
      expiresAt: new Date(NOW.getTime() + 1_000),
      householdId: membership(HouseholdRole.Owner).householdId,
      id: '44444444-4444-4444-8444-444444444444',
      revokedAt: null,
      targetEmail: 'partner@example.test',
    };

    expect(householdInvitationStatus(invitation, NOW)).toBe('pending');
    expect(householdInvitationStatus(invitation, invitation.expiresAt)).toBe('expired');
    expect(householdInvitationStatus({ ...invitation, revokedAt: NOW }, invitation.expiresAt)).toBe(
      'revoked',
    );
    expect(
      householdInvitationStatus(
        {
          ...invitation,
          acceptedAt: NOW,
          acceptedByUserId: membership(HouseholdRole.Member).userId,
        },
        invitation.expiresAt,
      ),
    ).toBe('accepted');
  });

  it('uses a configurable bounded seven-day default without a magic number in use cases', () => {
    expect(householdInvitationConfigurationFromEnvironment({}).ttlMs).toBe(7 * 24 * 60 * 60_000);
    expect(
      householdInvitationConfigurationFromEnvironment({ HOUSEHOLD_INVITATION_TTL_HOURS: '24' })
        .ttlMs,
    ).toBe(24 * 60 * 60_000);
    expect(() =>
      householdInvitationConfigurationFromEnvironment({ HOUSEHOLD_INVITATION_TTL_HOURS: '0' }),
    ).toThrow();
  });

  it('allows only an Active Owner to manage invitations and lets Active members view members', () => {
    const policy = new HouseholdAuthorizationPolicy();

    expect(
      policy.allows(membership(HouseholdRole.Owner), HouseholdCapability.ManageInvitations),
    ).toBe(true);
    expect(
      policy.allows(membership(HouseholdRole.Member), HouseholdCapability.ManageInvitations),
    ).toBe(false);
    expect(policy.allows(membership(HouseholdRole.Member), HouseholdCapability.ViewMembers)).toBe(
      true,
    );
    expect(
      policy.allows(
        membership(HouseholdRole.Owner, HouseholdMembershipStatus.Suspended),
        HouseholdCapability.ManageInvitations,
      ),
    ).toBe(false);
  });
});
