import type { HouseholdSummary } from '@copiloto/contracts';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import type { SessionSnapshot } from '../auth/auth0-session-coordinator';
import { createMobileSessionRuntime } from '../auth/session-runtime';
import type { HouseholdsSnapshot } from '../households-coordinator';
import type { HouseholdInvitationsSnapshot } from '../household-invitations-coordinator';

export interface MobileAppContextValue {
  acceptInvitation: (invitationToken: string) => Promise<HouseholdSummary | undefined>;
  authenticationAvailable: boolean;
  createHousehold: (name: string) => Promise<boolean>;
  createInvitation: (targetEmail: string) => Promise<boolean>;
  dismissRawInvitationToken: () => void;
  households: HouseholdsSnapshot;
  internalUserId?: string;
  invitations: HouseholdInvitationsSnapshot;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshHouseholdContext: () => Promise<void>;
  refreshHouseholds: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  revokeInvitation: (invitationId: string) => Promise<void>;
  selectedHousehold?: HouseholdSummary;
  selectHousehold: (householdId: string) => Promise<void>;
  session: SessionSnapshot;
}

const EMPTY_HOUSEHOLDS: HouseholdsSnapshot = { households: [], status: 'idle' };
const EMPTY_INVITATIONS: HouseholdInvitationsSnapshot = {
  invitations: [],
  members: [],
  status: 'idle',
};

const MobileAppContext = createContext<MobileAppContextValue | undefined>(undefined);

interface MobileAppProviderProps extends PropsWithChildren {
  runtimeFactory?: typeof createMobileSessionRuntime;
}

export function MobileAppProvider({
  children,
  runtimeFactory = createMobileSessionRuntime,
}: MobileAppProviderProps) {
  const [runtime] = useState(runtimeFactory);
  const [session, setSession] = useState<SessionSnapshot>(() =>
    runtime.coordinator === undefined
      ? {
          message: runtime.configurationError ?? 'La autenticación no está disponible.',
          status: 'error',
        }
      : runtime.coordinator.currentSnapshot(),
  );
  const [households, setHouseholds] = useState<HouseholdsSnapshot>(
    () => runtime.householdsCoordinator?.currentSnapshot() ?? EMPTY_HOUSEHOLDS,
  );
  const [invitations, setInvitations] = useState<HouseholdInvitationsSnapshot>(
    () => runtime.invitationsCoordinator?.currentSnapshot() ?? EMPTY_INVITATIONS,
  );

  useEffect(() => {
    const coordinator = runtime.coordinator;
    const client = runtime.client;

    if (coordinator === undefined || client === undefined) {
      return;
    }

    const unsubscribe = coordinator.subscribe(setSession);
    void coordinator.restore(() => client.getMe());
    return unsubscribe;
  }, [runtime]);

  useEffect(() => {
    const coordinator = runtime.householdsCoordinator;

    if (coordinator === undefined) {
      return;
    }

    return coordinator.subscribe(setHouseholds);
  }, [runtime]);

  useEffect(() => {
    const coordinator = runtime.invitationsCoordinator;

    if (coordinator === undefined) {
      return;
    }

    return coordinator.subscribe(setInvitations);
  }, [runtime]);

  const internalUserId = session.status === 'authenticated' ? session.profile?.id : undefined;

  useEffect(() => {
    const householdsCoordinator = runtime.householdsCoordinator;
    const invitationsCoordinator = runtime.invitationsCoordinator;

    if (householdsCoordinator === undefined || invitationsCoordinator === undefined) {
      return;
    }

    if (internalUserId === undefined) {
      householdsCoordinator.clearMemory();
      invitationsCoordinator.clearMemory();
      return;
    }

    invitationsCoordinator.activateForUser(internalUserId);
    void householdsCoordinator.loadForUser(internalUserId);
  }, [internalUserId, runtime]);

  const selectedHousehold = households.households.find(
    ({ id }) => id === households.selectedHouseholdId,
  );
  const selectedHouseholdId = selectedHousehold?.id;
  const selectedHouseholdRole = selectedHousehold?.role;

  useEffect(() => {
    if (
      internalUserId === undefined ||
      selectedHouseholdId === undefined ||
      selectedHouseholdRole === undefined ||
      runtime.invitationsCoordinator === undefined
    ) {
      return;
    }

    void runtime.invitationsCoordinator.loadForHousehold(
      internalUserId,
      selectedHouseholdId,
      selectedHouseholdRole === 'owner',
    );
  }, [internalUserId, runtime, selectedHouseholdId, selectedHouseholdRole]);

  const login = useCallback(async () => {
    if (runtime.coordinator !== undefined && runtime.client !== undefined) {
      await runtime.coordinator.login(() => runtime.client!.getMe());
    }
  }, [runtime]);

  const logout = useCallback(async () => {
    await runtime.coordinator?.logout();
  }, [runtime]);

  const refreshProfile = useCallback(async () => {
    if (runtime.coordinator !== undefined && runtime.client !== undefined) {
      await runtime.coordinator.refreshProfile(() => runtime.client!.getMe());
    }
  }, [runtime]);

  const refreshHouseholds = useCallback(async () => {
    if (internalUserId !== undefined) {
      await runtime.householdsCoordinator?.loadForUser(internalUserId);
    }
  }, [internalUserId, runtime]);

  const selectHousehold = useCallback(
    async (householdId: string) => {
      if (internalUserId !== undefined) {
        await runtime.householdsCoordinator?.selectHousehold(internalUserId, householdId);
      }
    },
    [internalUserId, runtime],
  );

  const createHousehold = useCallback(
    async (name: string) => {
      const coordinator = runtime.householdsCoordinator;

      if (internalUserId === undefined || coordinator === undefined) {
        return false;
      }

      await coordinator.createHousehold(internalUserId, name);
      return coordinator.currentSnapshot().status === 'ready';
    },
    [internalUserId, runtime],
  );

  const refreshHouseholdContext = useCallback(async () => {
    if (
      internalUserId !== undefined &&
      selectedHousehold !== undefined &&
      runtime.invitationsCoordinator !== undefined
    ) {
      await runtime.invitationsCoordinator.loadForHousehold(
        internalUserId,
        selectedHousehold.id,
        selectedHousehold.role === 'owner',
      );
    }
  }, [internalUserId, runtime, selectedHousehold]);

  const createInvitation = useCallback(
    async (targetEmail: string) => {
      const coordinator = runtime.invitationsCoordinator;

      if (
        internalUserId === undefined ||
        selectedHousehold?.role !== 'owner' ||
        coordinator === undefined
      ) {
        return false;
      }

      await coordinator.createInvitation(internalUserId, selectedHousehold.id, targetEmail);
      return coordinator.currentSnapshot().rawInvitationToken !== undefined;
    },
    [internalUserId, runtime, selectedHousehold],
  );

  const revokeInvitation = useCallback(
    async (invitationId: string) => {
      if (
        internalUserId === undefined ||
        selectedHousehold?.role !== 'owner' ||
        runtime.invitationsCoordinator === undefined
      ) {
        return;
      }

      await runtime.invitationsCoordinator.revokeInvitation(
        internalUserId,
        selectedHousehold.id,
        invitationId,
      );
    },
    [internalUserId, runtime, selectedHousehold],
  );

  const acceptInvitation = useCallback(
    async (invitationToken: string) => {
      if (internalUserId === undefined || runtime.invitationsCoordinator === undefined) {
        return undefined;
      }

      const acceptedHousehold = await runtime.invitationsCoordinator.acceptInvitation(
        internalUserId,
        invitationToken,
      );

      if (acceptedHousehold !== undefined && runtime.householdsCoordinator !== undefined) {
        await runtime.householdsCoordinator.loadForUser(internalUserId);
        await runtime.householdsCoordinator.selectHousehold(internalUserId, acceptedHousehold.id);
      }

      return acceptedHousehold;
    },
    [internalUserId, runtime],
  );

  const dismissRawInvitationToken = useCallback(() => {
    runtime.invitationsCoordinator?.dismissRawInvitationToken();
  }, [runtime]);

  const value = useMemo<MobileAppContextValue>(
    () => ({
      acceptInvitation,
      authenticationAvailable: runtime.coordinator !== undefined && runtime.client !== undefined,
      createHousehold,
      createInvitation,
      dismissRawInvitationToken,
      households,
      ...(internalUserId === undefined ? {} : { internalUserId }),
      invitations,
      login,
      logout,
      refreshHouseholdContext,
      refreshHouseholds,
      refreshProfile,
      revokeInvitation,
      ...(selectedHousehold === undefined ? {} : { selectedHousehold }),
      selectHousehold,
      session,
    }),
    [
      acceptInvitation,
      createHousehold,
      createInvitation,
      dismissRawInvitationToken,
      households,
      internalUserId,
      invitations,
      login,
      logout,
      refreshHouseholdContext,
      refreshHouseholds,
      refreshProfile,
      revokeInvitation,
      runtime.client,
      runtime.coordinator,
      selectedHousehold,
      selectHousehold,
      session,
    ],
  );

  return <MobileAppContext.Provider value={value}>{children}</MobileAppContext.Provider>;
}

export function useMobileApp(): MobileAppContextValue {
  const value = useContext(MobileAppContext);

  if (value === undefined) {
    throw new Error('useMobileApp must be used within MobileAppProvider.');
  }

  return value;
}
