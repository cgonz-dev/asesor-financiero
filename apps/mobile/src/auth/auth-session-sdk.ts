export interface SessionCredentials {
  accessToken: string;
  expiresAt: number;
}

export type SessionSdkErrorCode =
  'cancelled' | 'invalidGrant' | 'network' | 'noCredentials' | 'unavailable';

export class SessionSdkError extends Error {
  readonly code: SessionSdkErrorCode;

  constructor(code: SessionSdkErrorCode, options: { cause?: unknown } = {}) {
    super(
      'The mobile authentication operation failed.',
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = 'SessionSdkError';
    this.code = code;
  }
}

export interface AuthSessionSdk {
  authorize(): Promise<SessionCredentials>;
  clearLocalCredentials(): Promise<void>;
  getCredentials(options?: { forceRefresh?: boolean }): Promise<SessionCredentials>;
  hasValidCredentials(): Promise<boolean>;
  logout(): Promise<{ remoteRevocationConfirmed: boolean }>;
}
