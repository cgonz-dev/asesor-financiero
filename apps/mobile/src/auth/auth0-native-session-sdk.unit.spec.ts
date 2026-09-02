import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth0Mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  clearCredentials: vi.fn(),
  clearSession: vi.fn(),
  getCredentials: vi.fn(),
  hasValidCredentials: vi.fn(),
  revoke: vi.fn(),
  saveCredentials: vi.fn(),
}));

vi.mock('react-native-auth0', () => {
  class CredentialsManagerError extends Error {
    constructor(readonly type: string) {
      super(type);
    }
  }

  class WebAuthError extends Error {
    readonly code = 'mock';
    readonly status = 0;

    constructor(readonly type: string) {
      super(type);
    }
  }

  class Auth0 {
    readonly auth = { revoke: auth0Mocks.revoke };
    readonly credentialsManager = {
      clearCredentials: auth0Mocks.clearCredentials,
      getCredentials: auth0Mocks.getCredentials,
      hasValidCredentials: auth0Mocks.hasValidCredentials,
      saveCredentials: auth0Mocks.saveCredentials,
    };
    readonly webAuth = {
      authorize: auth0Mocks.authorize,
      clearSession: auth0Mocks.clearSession,
    };
  }

  return {
    CredentialsManagerError,
    CredentialsManagerErrorCodes: {
      DPOP_KEY_MISMATCH: 'DPOP_KEY_MISMATCH',
      DPOP_KEY_MISSING: 'DPOP_KEY_MISSING',
      DPOP_NOT_CONFIGURED: 'DPOP_NOT_CONFIGURED',
      INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
      NO_CREDENTIALS: 'NO_CREDENTIALS',
      NO_NETWORK: 'NO_NETWORK',
      NO_REFRESH_TOKEN: 'NO_REFRESH_TOKEN',
      RENEW_FAILED: 'RENEW_FAILED',
      SESSION_EXPIRED: 'SESSION_EXPIRED',
    },
    default: Auth0,
    WebAuthError,
    WebAuthErrorCodes: {
      NETWORK_ERROR: 'NETWORK_ERROR',
      USER_CANCELLED: 'USER_CANCELLED',
    },
  };
});

import { Auth0NativeSessionSdk } from './auth0-native-session-sdk';

const CREDENTIALS = {
  accessToken: 'header.payload.signature',
  expiresAt: 2_000_000_000,
  idToken: 'header.payload.signature',
  refreshToken: 'opaque-refresh-token',
  scope: 'openid profile email offline_access',
  tokenType: 'Bearer',
};

describe('Auth0NativeSessionSdk Google authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth0Mocks.authorize.mockResolvedValue(CREDENTIALS);
    auth0Mocks.saveCredentials.mockResolvedValue(undefined);
  });

  it('fija la conexión Google dentro del adaptador y conserva audience, scopes y callback', async () => {
    const sdk = new Auth0NativeSessionSdk({
      audience: 'https://api.copiloto-financiero.example',
      clientId: 'public-native-client-id',
      customScheme: 'copilotofinanciero',
      domain: 'tenant.example.auth0.com',
    });

    await expect(sdk.authorize()).resolves.toEqual({
      accessToken: CREDENTIALS.accessToken,
      expiresAt: CREDENTIALS.expiresAt,
    });

    expect(auth0Mocks.authorize).toHaveBeenCalledOnce();
    expect(auth0Mocks.authorize).toHaveBeenCalledWith(
      {
        audience: 'https://api.copiloto-financiero.example',
        connection: 'google-oauth2',
        scope: 'openid profile email offline_access',
      },
      { customScheme: 'copilotofinanciero' },
    );
    expect(auth0Mocks.saveCredentials).toHaveBeenCalledWith(CREDENTIALS);
  });

  it('no intenta una conexión alternativa cuando Auth0 rechaza el acceso', async () => {
    auth0Mocks.authorize.mockRejectedValueOnce(new Error('provider unavailable'));
    const sdk = new Auth0NativeSessionSdk({
      audience: 'https://api.copiloto-financiero.example',
      clientId: 'public-native-client-id',
      customScheme: 'copilotofinanciero',
      domain: 'tenant.example.auth0.com',
    });

    await expect(sdk.authorize()).rejects.toMatchObject({ code: 'unavailable' });
    expect(auth0Mocks.authorize).toHaveBeenCalledOnce();
    expect(auth0Mocks.saveCredentials).not.toHaveBeenCalled();
  });
});
