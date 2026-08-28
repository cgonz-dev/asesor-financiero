import {
  HouseholdCapability,
  HouseholdMembershipStatus,
  HouseholdRole,
  ResourceAction,
  ResourceVisibility,
  allowsHouseholdCapability,
  allowsResourceAction,
  type ResourceActorMembership,
  type ResourceAuthorizationInput,
} from '@copiloto/domain';
import { describe, expect, it } from 'vitest';

const HOUSEHOLD_A = '22222222-2222-4222-8222-222222222222';
const HOUSEHOLD_B = '33333333-3333-4333-8333-333333333333';
const OWNER_USER = '11111111-1111-4111-8111-111111111111';
const MEMBER_USER = '44444444-4444-4444-8444-444444444444';

function actor(overrides: Partial<ResourceActorMembership> = {}): ResourceActorMembership {
  return {
    householdId: HOUSEHOLD_A,
    membershipId: '55555555-5555-4555-8555-555555555555',
    role: HouseholdRole.Member,
    status: HouseholdMembershipStatus.Active,
    userId: MEMBER_USER,
    ...overrides,
  };
}

function authorization(
  overrides: Partial<ResourceAuthorizationInput> = {},
): ResourceAuthorizationInput {
  return {
    action: ResourceAction.View,
    actor: actor(),
    hasRequiredCapability: true,
    resource: {
      householdId: HOUSEHOLD_A,
      ownerUserId: OWNER_USER,
      selectedMembershipIds: [],
      visibility: ResourceVisibility.Private,
    },
    ...overrides,
  };
}

describe('Household capability policy', () => {
  it('uses Active membership and known roles with denial by default', () => {
    expect(
      allowsHouseholdCapability(
        { role: HouseholdRole.Owner, status: HouseholdMembershipStatus.Active },
        HouseholdCapability.ManageInvitations,
      ),
    ).toBe(true);
    expect(
      allowsHouseholdCapability(
        { role: HouseholdRole.Member, status: HouseholdMembershipStatus.Active },
        HouseholdCapability.ManageInvitations,
      ),
    ).toBe(false);
    expect(
      allowsHouseholdCapability(
        { role: HouseholdRole.Owner, status: HouseholdMembershipStatus.Suspended },
        HouseholdCapability.ManageInvitations,
      ),
    ).toBe(false);
    expect(
      allowsHouseholdCapability(
        { role: HouseholdRole.Owner, status: HouseholdMembershipStatus.Active },
        'unknownCapability',
      ),
    ).toBe(false);
  });
});

describe('Resource visibility policy', () => {
  it('allows Private only to its active owner and gives no Owner-role bypass', () => {
    expect(
      allowsResourceAction(
        authorization({
          actor: actor({ userId: OWNER_USER }),
        }),
      ),
    ).toBe(true);

    expect(
      allowsResourceAction(
        authorization({
          actor: actor({ role: HouseholdRole.Owner, userId: MEMBER_USER }),
        }),
      ),
    ).toBe(false);
  });

  it('allows SelectedMembers to its owner and explicitly selected Active memberships', () => {
    const selectedMembershipId = actor().membershipId;
    const selected = authorization({
      resource: {
        householdId: HOUSEHOLD_A,
        ownerUserId: OWNER_USER,
        selectedMembershipIds: [selectedMembershipId],
        visibility: ResourceVisibility.SelectedMembers,
      },
    });

    expect(allowsResourceAction(selected)).toBe(true);
    expect(
      allowsResourceAction({
        ...selected,
        actor: actor({ membershipId: '66666666-6666-4666-8666-666666666666' }),
      }),
    ).toBe(false);
    expect(allowsResourceAction({ ...selected, actor: actor({ userId: OWNER_USER }) })).toBe(true);
  });

  it('allows Household visibility to Active members with the required capability', () => {
    const householdVisible = authorization({
      resource: {
        householdId: HOUSEHOLD_A,
        ownerUserId: null,
        selectedMembershipIds: [],
        visibility: ResourceVisibility.Household,
      },
    });

    expect(allowsResourceAction(householdVisible)).toBe(true);
    expect(
      allowsResourceAction({
        ...householdVisible,
        actor: actor({ role: HouseholdRole.Owner }),
      }),
    ).toBe(true);
  });

  it('denies every inactive membership state', () => {
    for (const status of [
      HouseholdMembershipStatus.Suspended,
      HouseholdMembershipStatus.Left,
      HouseholdMembershipStatus.Removed,
    ]) {
      expect(allowsResourceAction(authorization({ actor: actor({ status }) }))).toBe(false);
    }
  });

  it('denies cross-Household references even when a membership identifier is selected', () => {
    const foreignActor = actor({ householdId: HOUSEHOLD_B });

    expect(
      allowsResourceAction(
        authorization({
          actor: foreignActor,
          resource: {
            householdId: HOUSEHOLD_A,
            ownerUserId: OWNER_USER,
            selectedMembershipIds: [foreignActor.membershipId],
            visibility: ResourceVisibility.SelectedMembers,
          },
        }),
      ),
    ).toBe(false);
  });

  it('denies when the applicable role capability is absent', () => {
    expect(allowsResourceAction(authorization({ hasRequiredCapability: false }))).toBe(false);
  });

  it('denies unknown actions, visibility and roles at runtime', () => {
    expect(allowsResourceAction(authorization({ action: 'unknownAction' }))).toBe(false);
    expect(
      allowsResourceAction(
        authorization({
          resource: {
            householdId: HOUSEHOLD_A,
            ownerUserId: MEMBER_USER,
            selectedMembershipIds: [],
            visibility: 'unknownVisibility' as ResourceVisibility,
          },
        }),
      ),
    ).toBe(false);
    expect(
      allowsResourceAction(
        authorization({
          actor: actor({ role: 'unknownRole' as typeof HouseholdRole.Owner }),
          resource: {
            householdId: HOUSEHOLD_A,
            ownerUserId: MEMBER_USER,
            selectedMembershipIds: [],
            visibility: ResourceVisibility.Private,
          },
        }),
      ),
    ).toBe(false);
  });
});
