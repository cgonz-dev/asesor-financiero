import { describe, expect, it } from 'vitest';

import {
  AcceptHouseholdInvitationRequestSchema,
  CreateHouseholdInvitationRequestSchema,
  CreateHouseholdInvitationResponseServerSchema,
  CreateHouseholdRequestSchema,
  HOUSEHOLD_NAME_MAX_LENGTH,
  HouseholdDetailServerSchema,
  ListHouseholdsResponseClientSchema,
  ListHouseholdsResponseServerSchema,
  RAW_HOUSEHOLD_INVITATION_TOKEN_LENGTH,
} from '../src/households';

const household = {
  id: '22222222-2222-4222-8222-222222222222',
  membershipStatus: 'active',
  name: 'Hogar de prueba',
  role: 'owner',
} as const;

describe('Household contracts', () => {
  it('normalizes a bounded Household name and rejects authority fields', () => {
    expect(CreateHouseholdRequestSchema.parse({ name: '  Hogar de prueba  ' })).toEqual({
      name: 'Hogar de prueba',
    });
    expect(
      CreateHouseholdRequestSchema.safeParse({
        name: 'Hogar de prueba',
        userId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(false);
  });

  it('rejects empty and excessively long names', () => {
    expect(CreateHouseholdRequestSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(
      CreateHouseholdRequestSchema.safeParse({
        name: 'H'.repeat(HOUSEHOLD_NAME_MAX_LENGTH + 1),
      }).success,
    ).toBe(false);
  });

  it('keeps server responses strict and clients compatible with safe additions', () => {
    expect(
      HouseholdDetailServerSchema.safeParse({ ...household, ownerUserId: 'private' }).success,
    ).toBe(false);
    expect(
      ListHouseholdsResponseServerSchema.safeParse({ households: [household], userId: 'private' })
        .success,
    ).toBe(false);
    expect(
      ListHouseholdsResponseClientSchema.parse({ households: [household], nextPage: null })
        .households,
    ).toEqual([household]);
  });

  it('keeps authority fields out of invitation commands and bounds the opaque token', () => {
    expect(
      CreateHouseholdInvitationRequestSchema.parse({ targetEmail: ' Partner@Example.Test ' }),
    ).toEqual({ targetEmail: 'partner@example.test' });
    expect(
      CreateHouseholdInvitationRequestSchema.safeParse({
        role: 'owner',
        targetEmail: 'partner@example.test',
      }).success,
    ).toBe(false);

    const token = 'A'.repeat(RAW_HOUSEHOLD_INVITATION_TOKEN_LENGTH);
    expect(AcceptHouseholdInvitationRequestSchema.parse({ invitationToken: token })).toEqual({
      invitationToken: token,
    });
    expect(
      AcceptHouseholdInvitationRequestSchema.safeParse({
        householdId: household.id,
        invitationToken: token,
        userId: '11111111-1111-4111-8111-111111111111',
      }).success,
    ).toBe(false);
    expect(
      AcceptHouseholdInvitationRequestSchema.safeParse({ invitationToken: 'A'.repeat(10_000) })
        .success,
    ).toBe(false);
  });

  it('allows the raw token only in the one-time creation response', () => {
    const invitation = {
      createdAt: '2026-08-25T18:00:00.000Z',
      expiresAt: '2026-09-01T18:00:00.000Z',
      id: '33333333-3333-4333-8333-333333333333',
      status: 'pending',
      targetEmailHint: 'p***@example.test',
    } as const;
    const invitationToken = 'A'.repeat(RAW_HOUSEHOLD_INVITATION_TOKEN_LENGTH);

    expect(
      CreateHouseholdInvitationResponseServerSchema.parse({ invitation, invitationToken }),
    ).toEqual({ invitation, invitationToken });
    expect(
      CreateHouseholdInvitationResponseServerSchema.safeParse({
        invitation: { ...invitation, tokenHash: 'private' },
        invitationToken,
      }).success,
    ).toBe(false);
  });
});
