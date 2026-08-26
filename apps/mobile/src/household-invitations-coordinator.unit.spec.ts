import type { HouseholdSummary } from '@copiloto/contracts';
import { describe, expect, it, vi } from 'vitest';

import { HouseholdInvitationsCoordinator } from './household-invitations-coordinator';

const USER_A = '11111111-1111-4111-8111-111111111111';
const HOUSEHOLD = {
  id: '22222222-2222-4222-8222-222222222222',
  membershipStatus: 'active',
  name: 'Hogar compartido',
  role: 'member',
} as const satisfies HouseholdSummary;
const INVITATION = {
  createdAt: '2026-08-25T18:00:00.000Z',
  expiresAt: '2026-09-01T18:00:00.000Z',
  id: '33333333-3333-4333-8333-333333333333',
  status: 'pending',
  targetEmailHint: 'p***@example.test',
} as const;
const TOKEN = 'A'.repeat(43);

function client() {
  return {
    accept: vi.fn(async () => ({ household: HOUSEHOLD })),
    create: vi.fn(async () => ({ invitation: INVITATION, invitationToken: TOKEN })),
    list: vi.fn(async () => ({ invitations: [INVITATION] })),
    listMembers: vi.fn(async () => ({
      members: [{ isCurrentUser: true, role: 'owner' as const }],
    })),
    revoke: vi.fn(async () => ({ invitation: { ...INVITATION, status: 'revoked' as const } })),
  };
}

describe('HouseholdInvitationsCoordinator', () => {
  it('loads invitation metadata for Owner but only members for Member', async () => {
    const api = client();
    const coordinator = new HouseholdInvitationsCoordinator(api);
    coordinator.activateForUser(USER_A);

    await coordinator.loadForHousehold(USER_A, HOUSEHOLD.id, true);
    expect(api.list).toHaveBeenCalledOnce();
    expect(coordinator.currentSnapshot()).toMatchObject({
      invitations: [INVITATION],
      members: [{ isCurrentUser: true, role: 'owner' }],
      status: 'ready',
    });

    await coordinator.loadForHousehold(USER_A, HOUSEHOLD.id, false);
    expect(api.list).toHaveBeenCalledOnce();
    expect(coordinator.currentSnapshot().invitations).toEqual([]);
  });

  it('keeps the raw token only in memory until explicitly dismissed', async () => {
    const api = client();
    const coordinator = new HouseholdInvitationsCoordinator(api);
    coordinator.activateForUser(USER_A);
    await coordinator.loadForHousehold(USER_A, HOUSEHOLD.id, true);

    await coordinator.createInvitation(USER_A, HOUSEHOLD.id, 'partner@example.test');
    expect(coordinator.currentSnapshot().rawInvitationToken).toBe(TOKEN);

    coordinator.dismissRawInvitationToken();
    expect(coordinator.currentSnapshot().rawInvitationToken).toBeUndefined();
  });

  it('blocks duplicate acceptance submissions and exposes the resulting Member Household', async () => {
    let finish: ((value: { household: typeof HOUSEHOLD }) => void) | undefined;
    const api = client();
    api.accept.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const coordinator = new HouseholdInvitationsCoordinator(api);
    coordinator.activateForUser(USER_A);

    const first = coordinator.acceptInvitation(USER_A, TOKEN);
    const second = coordinator.acceptInvitation(USER_A, TOKEN);
    expect(api.accept).toHaveBeenCalledOnce();
    expect(coordinator.currentSnapshot().status).toBe('accepting');
    finish?.({ household: HOUSEHOLD });

    await expect(first).resolves.toEqual(HOUSEHOLD);
    await expect(second).resolves.toEqual(HOUSEHOLD);
    expect(coordinator.currentSnapshot()).toMatchObject({
      acceptedHousehold: HOUSEHOLD,
      status: 'accepted',
    });
  });

  it('shows the same safe message for unusable invitation failures', async () => {
    const api = client();
    api.accept.mockRejectedValue(
      Object.assign(new Error('sensitive provider detail'), { status: 409 }),
    );
    const coordinator = new HouseholdInvitationsCoordinator(api);
    coordinator.activateForUser(USER_A);

    await expect(coordinator.acceptInvitation(USER_A, TOKEN)).resolves.toBeUndefined();
    expect(coordinator.currentSnapshot()).toMatchObject({
      message: 'La invitación no es válida o ya no está disponible.',
      status: 'error',
    });
  });

  it('clears members, invitations and raw token when User changes or logs out', async () => {
    const coordinator = new HouseholdInvitationsCoordinator(client());
    coordinator.activateForUser(USER_A);
    await coordinator.loadForHousehold(USER_A, HOUSEHOLD.id, true);
    await coordinator.createInvitation(USER_A, HOUSEHOLD.id, 'partner@example.test');

    coordinator.clearMemory();

    expect(coordinator.currentSnapshot()).toEqual({
      invitations: [],
      members: [],
      status: 'idle',
    });
  });
});
