import type { HouseholdSummary } from '@copiloto/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { HouseholdSelectionStore } from './household-selection-store';
import { HouseholdsCoordinator } from './households-coordinator';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '33333333-3333-4333-8333-333333333333';
const HOUSEHOLD_A = {
  id: '22222222-2222-4222-8222-222222222222',
  membershipStatus: 'active',
  name: 'Hogar A',
  role: 'owner',
} as const satisfies HouseholdSummary;
const HOUSEHOLD_B = {
  id: '44444444-4444-4444-8444-444444444444',
  membershipStatus: 'active',
  name: 'Hogar B',
  role: 'member',
} as const satisfies HouseholdSummary;

class MemorySelectionStore implements HouseholdSelectionStore {
  readonly values = new Map<string, string>();

  async get(internalUserId: string): Promise<string | undefined> {
    return this.values.get(internalUserId);
  }

  async set(internalUserId: string, householdId: string | undefined): Promise<void> {
    if (householdId === undefined) {
      this.values.delete(internalUserId);
    } else {
      this.values.set(internalUserId, householdId);
    }
  }
}

function client(households: HouseholdSummary[] = []) {
  return {
    create: vi.fn(async ({ name }: { name: string }): Promise<HouseholdSummary> => ({
      ...HOUSEHOLD_A,
      name: name.trim(),
    })),
    list: vi.fn(async () => ({ households })),
  };
}

describe('HouseholdsCoordinator', () => {
  it('publishes loading while the authorized list is pending', async () => {
    let finishList: ((value: { households: HouseholdSummary[] }) => void) | undefined;
    const api = client();
    api.list.mockImplementation(
      () =>
        new Promise<{ households: HouseholdSummary[] }>((resolve) => {
          finishList = resolve;
        }),
    );
    const coordinator = new HouseholdsCoordinator(api, new MemorySelectionStore());

    const loading = coordinator.loadForUser(USER_A);
    expect(coordinator.currentSnapshot()).toEqual({ households: [], status: 'loading' });
    finishList?.({ households: [] });
    await loading;
  });

  it('exposes the empty first-use state without fabricating a Household', async () => {
    const coordinator = new HouseholdsCoordinator(client(), new MemorySelectionStore());

    await coordinator.loadForUser(USER_A);

    expect(coordinator.currentSnapshot()).toEqual({ households: [], status: 'empty' });
  });

  it('auto-selects and persists the only authorized Household', async () => {
    const store = new MemorySelectionStore();
    const coordinator = new HouseholdsCoordinator(client([HOUSEHOLD_A]), store);

    await coordinator.loadForUser(USER_A);

    expect(coordinator.currentSnapshot()).toEqual({
      households: [HOUSEHOLD_A],
      selectedHouseholdId: HOUSEHOLD_A.id,
      status: 'ready',
    });
    expect(store.values.get(USER_A)).toBe(HOUSEHOLD_A.id);
  });

  it('restores a valid selection only after revalidating it against the authorized list', async () => {
    const store = new MemorySelectionStore();
    store.values.set(USER_A, HOUSEHOLD_B.id);
    const coordinator = new HouseholdsCoordinator(client([HOUSEHOLD_A, HOUSEHOLD_B]), store);

    await coordinator.loadForUser(USER_A);

    expect(coordinator.currentSnapshot().selectedHouseholdId).toBe(HOUSEHOLD_B.id);
  });

  it('changes the selection between multiple authorized Households', async () => {
    const coordinator = new HouseholdsCoordinator(
      client([HOUSEHOLD_A, HOUSEHOLD_B]),
      new MemorySelectionStore(),
    );
    await coordinator.loadForUser(USER_A);

    await coordinator.selectHousehold(USER_A, HOUSEHOLD_A.id);
    expect(coordinator.currentSnapshot().selectedHouseholdId).toBe(HOUSEHOLD_A.id);
    await coordinator.selectHousehold(USER_A, HOUSEHOLD_B.id);
    expect(coordinator.currentSnapshot().selectedHouseholdId).toBe(HOUSEHOLD_B.id);
  });

  it('discards a stale or foreign selection rather than treating it as authority', async () => {
    const store = new MemorySelectionStore();
    store.values.set(USER_A, HOUSEHOLD_B.id);
    const coordinator = new HouseholdsCoordinator(client([HOUSEHOLD_A]), store);

    await coordinator.loadForUser(USER_A);

    expect(coordinator.currentSnapshot().selectedHouseholdId).toBe(HOUSEHOLD_A.id);
    expect(store.values.get(USER_A)).toBe(HOUSEHOLD_A.id);
  });

  it('creates and selects a Household while preventing duplicate submissions', async () => {
    let finishCreate: ((value: HouseholdSummary) => void) | undefined;
    const api = client();
    api.create.mockImplementation(
      () =>
        new Promise<HouseholdSummary>((resolve) => {
          finishCreate = resolve;
        }),
    );
    const store = new MemorySelectionStore();
    const coordinator = new HouseholdsCoordinator(api, store);
    await coordinator.loadForUser(USER_A);

    const first = coordinator.createHousehold(USER_A, 'Casa');
    const second = coordinator.createHousehold(USER_A, 'Casa duplicada');
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(coordinator.currentSnapshot().status).toBe('creating');
    finishCreate?.({ ...HOUSEHOLD_A, name: 'Casa' });
    await Promise.all([first, second]);

    expect(coordinator.currentSnapshot()).toEqual({
      households: [{ ...HOUSEHOLD_A, name: 'Casa' }],
      selectedHouseholdId: HOUSEHOLD_A.id,
      status: 'ready',
    });
  });

  it('publishes a recoverable error when the list cannot be loaded', async () => {
    const api = client();
    api.list.mockRejectedValue(Object.assign(new Error('offline'), { code: 'network' }));
    const coordinator = new HouseholdsCoordinator(api, new MemorySelectionStore());

    await coordinator.loadForUser(USER_A);

    expect(coordinator.currentSnapshot()).toEqual({
      households: [],
      message: 'No pudimos consultar tus hogares por un problema de red.',
      status: 'error',
    });
  });

  it('keeps each User selection isolated', async () => {
    const store = new MemorySelectionStore();
    const coordinator = new HouseholdsCoordinator(client([HOUSEHOLD_A, HOUSEHOLD_B]), store);
    await coordinator.loadForUser(USER_A);
    await coordinator.selectHousehold(USER_A, HOUSEHOLD_A.id);
    await coordinator.loadForUser(USER_B);
    await coordinator.selectHousehold(USER_B, HOUSEHOLD_B.id);

    expect(store.values.get(USER_A)).toBe(HOUSEHOLD_A.id);
    expect(store.values.get(USER_B)).toBe(HOUSEHOLD_B.id);
  });

  it('clears sensitive in-memory context on logout without deleting the preference', async () => {
    const store = new MemorySelectionStore();
    const coordinator = new HouseholdsCoordinator(client([HOUSEHOLD_A]), store);
    await coordinator.loadForUser(USER_A);

    coordinator.clearMemory();

    expect(coordinator.currentSnapshot()).toEqual({ households: [], status: 'idle' });
    expect(store.values.get(USER_A)).toBe(HOUSEHOLD_A.id);
  });
});
