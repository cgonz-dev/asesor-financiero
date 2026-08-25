import Auth0, {
  CredentialsManagerError,
  CredentialsManagerErrorCodes,
  WebAuthError,
  WebAuthErrorCodes,
  type Credentials,
} from 'react-native-auth0';

import type { Auth0Configuration } from '../config';
import { type AuthSessionSdk, type SessionCredentials, SessionSdkError } from './auth-session-sdk';

const AUTH0_SCOPE = 'openid profile email offline_access';
const MINIMUM_ACCESS_TOKEN_TTL_SECONDS = 30;
const SAFE_AUTH0_ERROR_CODE = /^[A-Za-z0-9._-]{1,80}$/;

function publicCredentials(credentials: Credentials): SessionCredentials {
  return {
    accessToken: credentials.accessToken,
    expiresAt: credentials.expiresAt,
  };
}

function sessionSdkError(error: unknown): SessionSdkError {
  if (error instanceof SessionSdkError) {
    return error;
  }

  if (error instanceof CredentialsManagerError) {
    if (error.type === CredentialsManagerErrorCodes.NO_CREDENTIALS) {
      return new SessionSdkError('noCredentials', { cause: error });
    }

    if (error.type === CredentialsManagerErrorCodes.NO_NETWORK) {
      return new SessionSdkError('network', { cause: error });
    }

    if (
      error.type === CredentialsManagerErrorCodes.INVALID_CREDENTIALS ||
      error.type === CredentialsManagerErrorCodes.NO_REFRESH_TOKEN ||
      error.type === CredentialsManagerErrorCodes.RENEW_FAILED ||
      error.type === CredentialsManagerErrorCodes.SESSION_EXPIRED ||
      error.type === CredentialsManagerErrorCodes.DPOP_KEY_MISSING ||
      error.type === CredentialsManagerErrorCodes.DPOP_KEY_MISMATCH ||
      error.type === CredentialsManagerErrorCodes.DPOP_NOT_CONFIGURED
    ) {
      return new SessionSdkError('invalidGrant', { cause: error });
    }
  }

  if (error instanceof WebAuthError) {
    if (__DEV__) {
      console.warn('Auth0 web authentication failed.', {
        code: SAFE_AUTH0_ERROR_CODE.test(error.code) ? error.code : 'redacted',
        status: error.status,
        type: error.type,
      });
    }

    if (error.type === WebAuthErrorCodes.USER_CANCELLED) {
      return new SessionSdkError('cancelled', { cause: error });
    }

    if (error.type === WebAuthErrorCodes.NETWORK_ERROR) {
      return new SessionSdkError('network', { cause: error });
    }
  }

  return new SessionSdkError('unavailable', { cause: error });
}

export class Auth0NativeSessionSdk implements AuthSessionSdk {
  private readonly client: Auth0;
  private refreshToken: string | undefined;

  constructor(private readonly configuration: Auth0Configuration) {
    this.client = new Auth0({
      clientId: configuration.clientId,
      domain: configuration.domain,
    });
  }

  async authorize(): Promise<SessionCredentials> {
    try {
      const credentials = await this.client.webAuth.authorize(
        {
          audience: this.configuration.audience,
          scope: AUTH0_SCOPE,
        },
        { customScheme: this.configuration.customScheme },
      );

      await this.client.credentialsManager.saveCredentials(credentials);
      return this.captureCredentials(credentials);
    } catch (error: unknown) {
      throw sessionSdkError(error);
    }
  }

  async clearLocalCredentials(): Promise<void> {
    try {
      await this.client.credentialsManager.clearCredentials();
    } catch (error: unknown) {
      throw sessionSdkError(error);
    }
  }

  async getCredentials(options: { forceRefresh?: boolean } = {}): Promise<SessionCredentials> {
    try {
      const credentials = await this.client.credentialsManager.getCredentials(
        AUTH0_SCOPE,
        MINIMUM_ACCESS_TOKEN_TTL_SECONDS,
        { audience: this.configuration.audience },
        options.forceRefresh ?? false,
      );

      return this.captureCredentials(credentials);
    } catch (error: unknown) {
      throw sessionSdkError(error);
    }
  }

  async hasValidCredentials(): Promise<boolean> {
    try {
      return await this.client.credentialsManager.hasValidCredentials(
        MINIMUM_ACCESS_TOKEN_TTL_SECONDS,
      );
    } catch (error: unknown) {
      throw sessionSdkError(error);
    }
  }

  async logout(): Promise<{ remoteRevocationConfirmed: boolean }> {
    const refreshToken = this.refreshToken;
    this.refreshToken = undefined;

    try {
      await this.client.credentialsManager.clearCredentials();
    } catch {
      // The in-memory session is already cleared by the coordinator; continue remote cleanup.
    }

    let remoteRevocationConfirmed = false;

    if (refreshToken !== undefined) {
      try {
        await this.client.auth.revoke({ refreshToken });
        remoteRevocationConfirmed = true;
      } catch {
        remoteRevocationConfirmed = false;
      }
    }

    try {
      await this.client.webAuth.clearSession({}, { customScheme: this.configuration.customScheme });
    } catch {
      // Browser logout is best effort and never restores locally cleared credentials.
    }

    return { remoteRevocationConfirmed };
  }

  private captureCredentials(credentials: Credentials): SessionCredentials {
    this.refreshToken = credentials.refreshToken ?? this.refreshToken;
    return publicCredentials(credentials);
  }
}
