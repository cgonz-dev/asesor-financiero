import { HouseholdMembershipStatus, HouseholdRole } from '@copiloto/domain';
import { describe, expect, it, vi } from 'vitest';

import { CreateHousehold } from '../src/households/application/create-household';
import { HouseholdNotFoundError } from '../src/households/application/errors';
import { GetHousehold } from '../src/households/application/get-household';
import {
  HouseholdAuthorizationPolicy,
  HouseholdCapability,
} from '../src/households/application/household-authorization.policy';
import { HouseholdContextResolver } from '../src/households/application/household-context-resolver';
import type {
  HouseholdRepository,
  UserHousehold,
} from '../src/households/application/household-repository';
import { ListUserHouseholds } from '../src/households/application/list-user-households';

const USER_ID = '018f85d7-6b2a-7f25-bfd0-554a23d4b65a';
const NOW = new Date('2026-08-13T12:00:00.000Z');

function userHousehold(
  overrides: {
    householdId?: string;
    name?: string;
    role?: (typeof HouseholdRole)[keyof typeof HouseholdRole];
    status?: (typeof HouseholdMembershipStatus)[keyof typeof HouseholdMembershipStatus];
  } = {},
): UserHousehold {
  const householdId = overrides.householdId ?? '018f85d7-6b2a-7f25-bfd0-554a23d4b65b';

  return {
    household: {
      id: householdId,
      name: overrides.name ?? 'Hogar piloto',
      createdAt: NOW,
      updatedAt: NOW,
    },
    membership: {
      id: '018f85d7-6b2a-7f25-bfd0-554a23d4b65c',
      householdId,
      userId: USER_ID,
      role: overrides.role ?? HouseholdRole.Owner,
      status: overrides.status ?? HouseholdMembershipStatus.Active,
      createdAt: NOW,
      updatedAt: NOW,
    },
  };
}

function repositoryFake(): HouseholdRepository {
  return {
    createWithInitialOwner: vi.fn(),
    findActiveForUser: vi.fn(),
    findActiveForUserAndHousehold: vi.fn(),
    findActiveMembership: vi.fn(),
  };
}

describe('CreateHousehold', () => {
  it('normalizes the name and requests exactly one initial Owner Active membership', async () => {
    const repository = repositoryFake();
    const expected = userHousehold();
    vi.mocked(repository.createWithInitialOwner).mockResolvedValue(expected);
    const useCase = new CreateHousehold(repository);

    await expect(
      useCase.execute({ internalUserId: USER_ID, name: '  Hogar piloto  ' }),
    ).resolves.toEqual(expected);

    expect(repository.createWithInitialOwner).toHaveBeenCalledOnce();
    expect(repository.createWithInitialOwner).toHaveBeenCalledWith({
      name: 'Hogar piloto',
      ownerUserId: USER_ID,
      ownerRole: HouseholdRole.Owner,
      membershipStatus: HouseholdMembershipStatus.Active,
    });
  });

  it('rejects invalid input before opening persistence work', () => {
    const repository = repositoryFake();
    const useCase = new CreateHousehold(repository);

    expect(() => useCase.execute({ internalUserId: USER_ID, name: '   ' })).toThrow(
      'Household name must not be empty.',
    );
    expect(repository.createWithInitialOwner).not.toHaveBeenCalled();
  });
});

describe('Household context authorization', () => {
  it('allows basic configuration only to Active Owner or Member memberships', () => {
    const policy = new HouseholdAuthorizationPolicy();

    expect(
      policy.allows(
        userHousehold({ role: HouseholdRole.Owner }).membership,
        HouseholdCapability.ViewBasicConfiguration,
      ),
    ).toBe(true);
    expect(
      policy.allows(
        userHousehold({ role: HouseholdRole.Member }).membership,
        HouseholdCapability.ViewBasicConfiguration,
      ),
    ).toBe(true);

    for (const status of [
      HouseholdMembershipStatus.Suspended,
      HouseholdMembershipStatus.Left,
      HouseholdMembershipStatus.Removed,
    ]) {
      expect(
        policy.allows(
          userHousehold({ status }).membership,
          HouseholdCapability.ViewBasicConfiguration,
        ),
      ).toBe(false);
    }

    expect(policy.allows(userHousehold().membership, 'unknownCapability')).toBe(false);
  });

  it('resolves an authorized Household through the scoped repository query', async () => {
    const repository = repositoryFake();
    const expected = userHousehold();
    vi.mocked(repository.findActiveForUserAndHousehold).mockResolvedValue(expected);
    const resolver = new HouseholdContextResolver(repository, new HouseholdAuthorizationPolicy());
    const useCase = new GetHousehold(resolver);

    await expect(
      useCase.execute({
        householdId: expected.household.id,
        internalUserId: USER_ID,
      }),
    ).resolves.toEqual(expected);
    expect(repository.findActiveForUserAndHousehold).toHaveBeenCalledWith({
      householdId: expected.household.id,
      userId: USER_ID,
    });
  });

  it('denies by default without revealing whether the Household exists', async () => {
    const repository = repositoryFake();
    vi.mocked(repository.findActiveForUserAndHousehold).mockResolvedValue(null);
    const resolver = new HouseholdContextResolver(repository, new HouseholdAuthorizationPolicy());

    await expect(
      resolver.resolve({
        capability: HouseholdCapability.ViewBasicConfiguration,
        householdId: '018f85d7-6b2a-7f25-bfd0-554a23d4b65b',
        internalUserId: USER_ID,
      }),
    ).rejects.toBeInstanceOf(HouseholdNotFoundError);
  });
});

describe('ListUserHouseholds', () => {
  it('lists only the active memberships returned for the resolved internal User', async () => {
    const repository = repositoryFake();
    const expected = [
      userHousehold(),
      userHousehold({
        householdId: '018f85d7-6b2a-7f25-bfd0-554a23d4b65d',
        name: 'Segundo hogar',
      }),
    ];
    vi.mocked(repository.findActiveForUser).mockResolvedValue(expected);
    const useCase = new ListUserHouseholds(repository);

    await expect(useCase.execute(USER_ID)).resolves.toEqual(expected);
    expect(repository.findActiveForUser).toHaveBeenCalledOnce();
    expect(repository.findActiveForUser).toHaveBeenCalledWith(USER_ID);
  });
});
