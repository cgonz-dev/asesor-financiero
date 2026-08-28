import type { SessionStatus } from '../auth/auth0-session-coordinator';

export interface RootRouteAccess {
  application: boolean;
  sessionGate: boolean;
}

export function getRootRouteAccess(status: SessionStatus): RootRouteAccess {
  const authenticated = status === 'authenticated';

  return {
    application: authenticated,
    sessionGate: !authenticated,
  };
}
