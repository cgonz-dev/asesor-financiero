import { HouseholdMembershipStatus, HouseholdRole } from '@copiloto/domain';
import { describe, expect, it, vi } from 'vitest';

import { CreateHousehold } from '../src/households/application/create-household';
import type {
  HouseholdRepository,
  UserHousehold,
} from '../src/households/application/household-repository';
import { ListUserHouseholds } from '../src/households/application/list-user-households';

const USER_ID = '018f85d7-6b2a-7f25-bfd0-554a23d4b65a';
const NOW = new Date('2026-08-13T12:00:00.000Z');

function userHousehold(overrides: { householdId?: string; name?: string } = {}): UserHousehold {
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
      role: HouseholdRole.Owner,
      status: HouseholdMembershipStatus.Active,
      createdAt: NOW,
      updatedAt: NOW,
    },
  };
}

function repositoryFake(): HouseholdRepository {
  return {
    createWithInitialOwner: vi.fn(),
    findActiveForUser: vi.fn(),
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
