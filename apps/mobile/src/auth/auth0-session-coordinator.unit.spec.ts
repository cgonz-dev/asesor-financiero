import type { MeResponse } from '@copiloto/contracts';
import { describe, expect, it, vi } from 'vitest';

import { type AuthSessionSdk, type SessionCredentials, SessionSdkError } from './auth-session-sdk';
import { Auth0SessionCoordinator } from './auth0-session-coordinator';

const PROFILE: MeResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'active',
};

const VALID_CREDENTIALS: SessionCredentials = {
  accessToken: 'header.payload.signature',
  expiresAt: Math.floor(Date.now() / 1_000) + 300,
};

function fakeSdk(overrides: Partial<AuthSessionSdk> = {}): AuthSessionSdk {
  return {
    authorize: vi.fn(async () => VALID_CREDENTIALS),
    clearLocalCredentials: vi.fn(async () => undefined),
    getCredentials: vi.fn(async () => VALID_CREDENTIALS),
    hasValidCredentials: vi.fn(async () => true),
    logout: vi.fn(async () => ({ remoteRevocationConfirmed: true })),
    ...overrides,
  };
}

describe('Auth0SessionCoordinator', () => {
  it('restores a secure session and authenticates only after /me resolves', async () => {
    const coordinator = new Auth0SessionCoordinator(fakeSdk());
    let releaseProfile: ((profile: MeResponse) => void) | undefined;
    const profile = new Promise<MeResponse>((resolve) => {
      releaseProfile = resolve;
    });
    const restoring = coordinator.restore(() => profile);

    expect(coordinator.currentSnapshot().status).toBe('restoring');
    releaseProfile?.(PROFILE);
    await restoring;
    expect(coordinator.currentSnapshot()).toEqual({
      profile: PROFILE,
      status: 'authenticated',
    });
  });

  it('returns to login when no secure credentials exist', async () => {
    const coordinator = new Auth0SessionCoordinator(
      fakeSdk({ hasValidCredentials: vi.fn(async () => false) }),
    );

    await coordinator.restore(async () => PROFILE);
    expect(coordinator.currentSnapshot()).toEqual({ status: 'unauthenticated' });
  });

  it('does not claim authentication when the network prevents restoration', async () => {
    const coordinator = new Auth0SessionCoordinator(
      fakeSdk({
        getCredentials: vi.fn(async () => {
          throw new SessionSdkError('network');
        }),
      }),
    );

    await coordinator.restore(async () => PROFILE);
    expect(coordinator.currentSnapshot()).toMatchObject({ status: 'error' });
    expect(coordinator.currentSnapshot().profile).toBeUndefined();
  });

  it('clears invalid or revoked credentials during restoration', async () => {
    const clearLocalCredentials = vi.fn(async () => undefined);
    const coordinator = new Auth0SessionCoordinator(
      fakeSdk({
        clearLocalCredentials,
        getCredentials: vi.fn(async () => {
          throw new SessionSdkError('invalidGrant');
        }),
      }),
    );

    await coordinator.restore(async () => PROFILE);
    expect(clearLocalCredentials).toHaveBeenCalledOnce();
    expect(coordinator.currentSnapshot()).toEqual({ status: 'unauthenticated' });
  });

  it('uses one single-flight renewal for concurrent token requests', async () => {
    let release: ((credentials: SessionCredentials) => void) | undefined;
    const pendingCredentials = new Promise<SessionCredentials>((resolve) => {
      release = resolve;
    });
    const getCredentials = vi.fn(async () => pendingCredentials);
    const coordinator = new Auth0SessionCoordinator(fakeSdk({ getCredentials }));
    const requests = Array.from({ length: 10 }, () => coordinator.getAccessToken());

    expect(getCredentials).toHaveBeenCalledOnce();
    release?.(VALID_CREDENTIALS);
    await expect(Promise.all(requests)).resolves.toEqual(
      Array.from({ length: 10 }, () => VALID_CREDENTIALS.accessToken),
    );
  });

  it('requests a forced renewal after a caller invalidates the current access token', async () => {
    const getCredentials = vi.fn(async () => VALID_CREDENTIALS);
    const coordinator = new Auth0SessionCoordinator(fakeSdk({ getCredentials }));

    await coordinator.getAccessToken();
    await coordinator.getAccessToken({ forceRefresh: true });

    expect(getCredentials).toHaveBeenNthCalledWith(1, { forceRefresh: false });
    expect(getCredentials).toHaveBeenNthCalledWith(2, { forceRefresh: true });
  });

  it('clears the session when token renewal reports revocation outside restoration', async () => {
    const clearLocalCredentials = vi.fn(async () => undefined);
    const coordinator = new Auth0SessionCoordinator(
      fakeSdk({
        clearLocalCredentials,
        getCredentials: vi.fn(async () => {
          throw new SessionSdkError('invalidGrant');
        }),
      }),
    );

    await expect(coordinator.getAccessToken()).rejects.toMatchObject({ code: 'invalidGrant' });
    expect(clearLocalCredentials).toHaveBeenCalledOnce();
    expect(coordinator.currentSnapshot()).toEqual({ status: 'unauthenticated' });
  });

  it('logs in through the SDK and resolves the internal profile', async () => {
    const authorize = vi.fn(async () => VALID_CREDENTIALS);
    const coordinator = new Auth0SessionCoordinator(fakeSdk({ authorize }));

    await coordinator.login(async () => PROFILE);

    expect(authorize).toHaveBeenCalledOnce();
    expect(coordinator.currentSnapshot()).toEqual({
      profile: PROFILE,
      status: 'authenticated',
    });
  });

  it('returns quietly to the Google access screen when the user cancels', async () => {
    const coordinator = new Auth0SessionCoordinator(
      fakeSdk({
        authorize: vi.fn(async () => {
          throw new SessionSdkError('cancelled');
        }),
      }),
    );

    await coordinator.login(async () => PROFILE);

    expect(coordinator.currentSnapshot()).toEqual({ status: 'unauthenticated' });
  });

  it('shows a safe retryable message when the Google flow has no network', async () => {
    const coordinator = new Auth0SessionCoordinator(
      fakeSdk({
        authorize: vi.fn(async () => {
          throw new SessionSdkError('network');
        }),
      }),
    );

    await coordinator.login(async () => PROFILE);

    expect(coordinator.currentSnapshot()).toEqual({
      message: 'No pudimos validar la sesión por un problema de red.',
      status: 'error',
    });
  });

  it('does not expose provider details when Google authentication is unavailable', async () => {
    const coordinator = new Auth0SessionCoordinator(
      fakeSdk({
        authorize: vi.fn(async () => {
          throw new SessionSdkError('unavailable', {
            cause: new Error('oauth_error=internal tenant detail'),
          });
        }),
      }),
    );

    await coordinator.login(async () => PROFILE);

    expect(coordinator.currentSnapshot()).toEqual({
      message: 'No pudimos completar la autenticación de forma segura.',
      status: 'error',
    });
  });

  it('reports visible progress and success while refreshing the internal profile', async () => {
    const coordinator = new Auth0SessionCoordinator(fakeSdk());
    await coordinator.login(async () => PROFILE);
    let releaseProfile: ((profile: MeResponse) => void) | undefined;
    const pendingProfile = new Promise<MeResponse>((resolve) => {
      releaseProfile = resolve;
    });

    const refreshing = coordinator.refreshProfile(() => pendingProfile);

    expect(coordinator.currentSnapshot()).toEqual({
      profile: PROFILE,
      profileRefreshStatus: 'refreshing',
      status: 'authenticated',
    });

    releaseProfile?.(PROFILE);
    await refreshing;

    expect(coordinator.currentSnapshot()).toEqual({
      profile: PROFILE,
      profileRefreshStatus: 'succeeded',
      status: 'authenticated',
    });
  });

  it('clears memory, cancels requests and remains logged out when remote revocation is offline', async () => {
    const logout = vi.fn(async () => ({ remoteRevocationConfirmed: false }));
    const coordinator = new Auth0SessionCoordinator(fakeSdk({ logout }));
    const request = new AbortController();
    coordinator.registerAuthenticatedRequest(request);

    await coordinator.logout();

    expect(request.signal.aborted).toBe(true);
    expect(logout).toHaveBeenCalledOnce();
    expect(coordinator.currentSnapshot()).toEqual({ status: 'unauthenticated' });
    await expect(coordinator.getAccessToken()).rejects.toMatchObject({
      code: 'noCredentials',
    });
  });

  it('cannot repopulate the in-memory token when a renewal finishes after logout', async () => {
    let release: ((credentials: SessionCredentials) => void) | undefined;
    const pendingCredentials = new Promise<SessionCredentials>((resolve) => {
      release = resolve;
    });
    const coordinator = new Auth0SessionCoordinator(
      fakeSdk({ getCredentials: vi.fn(async () => pendingCredentials) }),
    );
    const renewal = coordinator.getAccessToken();

    await coordinator.logout();
    release?.(VALID_CREDENTIALS);

    await expect(renewal).rejects.toMatchObject({ code: 'noCredentials' });
    await expect(coordinator.getAccessToken()).rejects.toMatchObject({
      code: 'noCredentials',
    });
  });
});
