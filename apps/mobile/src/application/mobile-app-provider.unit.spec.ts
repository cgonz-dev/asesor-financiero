import type { HouseholdSummary } from '@copiloto/contracts';
import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import type { SessionSnapshot } from '../auth/auth0-session-coordinator';
import type { MobileSessionRuntime } from '../auth/session-runtime';
import type { HouseholdInvitationsSnapshot } from '../household-invitations-coordinator';
import type { HouseholdsSnapshot } from '../households-coordinator';
import { getRootRouteAccess } from '../navigation/root-route-access';
import { MobileAppProvider, useMobileApp, type MobileAppContextValue } from './mobile-app-provider';

vi.mock('../auth/session-runtime', () => ({
  createMobileSessionRuntime: vi.fn(() => ({})),
}));

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const HOUSEHOLD: HouseholdSummary = {
  id: '22222222-2222-4222-8222-222222222222',
  membershipStatus: 'active',
  name: 'Casa',
  role: 'owner',
};

type SessionListener = (snapshot: SessionSnapshot) => void;
type HouseholdsListener = (snapshot: HouseholdsSnapshot) => void;
type InvitationsListener = (snapshot: HouseholdInvitationsSnapshot) => void;

class SessionCoordinatorStub {
  readonly logout = vi.fn(async () => {
    this.snapshot = { status: 'unauthenticated' };
    this.emit();
  });

  private readonly listeners = new Set<SessionListener>();
  private snapshot: SessionSnapshot = {
    profile: { id: PROFILE_ID, status: 'active' },
    status: 'authenticated',
  };

  currentSnapshot(): SessionSnapshot {
    return this.snapshot;
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async restore(): Promise<void> {}

  async login(): Promise<void> {}

  async refreshProfile(): Promise<void> {}

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }
}

class HouseholdsCoordinatorStub {
  readonly clearMemory = vi.fn(() => {
    this.snapshot = { households: [], status: 'idle' };
    this.emit();
  });

  private readonly listeners = new Set<HouseholdsListener>();
  private snapshot: HouseholdsSnapshot = {
    households: [HOUSEHOLD],
    selectedHouseholdId: HOUSEHOLD.id,
    status: 'ready',
  };

  currentSnapshot(): HouseholdsSnapshot {
    return this.snapshot;
  }

  subscribe(listener: HouseholdsListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async loadForUser(): Promise<void> {}

  async selectHousehold(): Promise<void> {}

  async createHousehold(): Promise<void> {}

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }
}

class InvitationsCoordinatorStub {
  readonly clearMemory = vi.fn(() => {
    this.snapshot = { invitations: [], members: [], status: 'idle' };
    this.emit();
  });

  private readonly listeners = new Set<InvitationsListener>();
  private snapshot: HouseholdInvitationsSnapshot = {
    invitations: [],
    members: [
      {
        isCurrentUser: true,
        role: 'owner',
      },
    ],
    status: 'ready',
  };

  currentSnapshot(): HouseholdInvitationsSnapshot {
    return this.snapshot;
  }

  subscribe(listener: InvitationsListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  activateForUser(): void {}

  async loadForHousehold(): Promise<void> {}

  async createInvitation(): Promise<void> {}

  async revokeInvitation(): Promise<void> {}

  async acceptInvitation(): Promise<HouseholdSummary | undefined> {
    return undefined;
  }

  dismissRawInvitationToken(): void {}

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }
}

describe('MobileAppProvider logout regression', () => {
  it('clears the user context and changes the root navigation target exactly once without a render cycle', async () => {
    const sessionCoordinator = new SessionCoordinatorStub();
    const householdsCoordinator = new HouseholdsCoordinatorStub();
    const invitationsCoordinator = new InvitationsCoordinatorStub();
    const runtime = {
      client: { getMe: vi.fn() },
      coordinator: sessionCoordinator,
      householdsCoordinator,
      invitationsCoordinator,
    } as unknown as MobileSessionRuntime;
    const navigationTargets: Array<'application' | 'sessionGate'> = [];
    let context: MobileAppContextValue | undefined;
    let previousTarget: 'application' | 'sessionGate' | undefined;
    let renderCount = 0;

    function Probe() {
      context = useMobileApp();
      ++renderCount;
      const access = getRootRouteAccess(context.session.status);
      const target = access.application ? 'application' : 'sessionGate';

      useEffect(() => {
        if (target !== previousTarget) {
          previousTarget = target;
          navigationTargets.push(target);
        }
      }, [target]);

      return null;
    }

    let renderer: ReactTestRenderer | undefined;

    await act(async () => {
      renderer = create(
        createElement(MobileAppProvider, { runtimeFactory: () => runtime }, createElement(Probe)),
      );
    });

    expect(context?.session.status).toBe('authenticated');
    expect(context?.internalUserId).toBe(PROFILE_ID);
    expect(navigationTargets).toEqual(['application']);

    await act(async () => {
      await context?.logout();
    });

    expect(sessionCoordinator.logout).toHaveBeenCalledOnce();
    expect(context?.session).toEqual({ status: 'unauthenticated' });
    expect(context?.internalUserId).toBeUndefined();
    expect(context?.households).toEqual({ households: [], status: 'idle' });
    expect(context?.invitations).toEqual({ invitations: [], members: [], status: 'idle' });
    expect(householdsCoordinator.clearMemory).toHaveBeenCalledOnce();
    expect(invitationsCoordinator.clearMemory).toHaveBeenCalledOnce();
    expect(navigationTargets).toEqual(['application', 'sessionGate']);

    const stableRenderCount = renderCount;

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(renderCount).toBe(stableRenderCount);
    expect(navigationTargets).toEqual(['application', 'sessionGate']);

    await act(async () => {
      renderer?.unmount();
    });
  });
});
