import type { MeResponse } from '@copiloto/contracts';

import type { AuthSessionSdk, SessionCredentials } from './auth-session-sdk';
import { SessionSdkError } from './auth-session-sdk';
import type { TokenProvider } from './token-provider';

const ACCESS_TOKEN_MEMORY_LEEWAY_SECONDS = 30;

export type SessionStatus =
  'authenticated' | 'authenticating' | 'error' | 'restoring' | 'unauthenticated';

export interface SessionSnapshot {
  message?: string;
  profile?: MeResponse;
  profileRefreshStatus?: 'refreshing' | 'succeeded';
  status: SessionStatus;
}

export type ProfileLoader = () => Promise<MeResponse>;
type SessionListener = (snapshot: SessionSnapshot) => void;

function isCredentialsUsable(credentials: SessionCredentials): boolean {
  return credentials.expiresAt > Date.now() / 1_000 + ACCESS_TOKEN_MEMORY_LEEWAY_SECONDS;
}

function canProvideToken(status: SessionStatus): boolean {
  return status === 'authenticated' || status === 'authenticating' || status === 'restoring';
}

function isInvalidSession(error: unknown): boolean {
  return (
    (error instanceof SessionSdkError &&
      (error.code === 'invalidGrant' || error.code === 'noCredentials')) ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'unauthorized')
  );
}

function isNetworkFailure(error: unknown): boolean {
  return (
    (error instanceof SessionSdkError && error.code === 'network') ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'network' || error.code === 'timeout'))
  );
}

export class Auth0SessionCoordinator implements TokenProvider {
  private accessToken: SessionCredentials | undefined;
  private readonly activeRequests = new Set<AbortController>();
  private generation = 0;
  private readonly listeners = new Set<SessionListener>();
  private renewalFlight: Promise<SessionCredentials> | undefined;
  private snapshot: SessionSnapshot = { status: 'restoring' };

  constructor(private readonly sdk: AuthSessionSdk) {}

  currentSnapshot(): SessionSnapshot {
    return this.snapshot;
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  async restore(loadProfile: ProfileLoader): Promise<void> {
    const generation = ++this.generation;
    this.transition({ status: 'restoring' });

    try {
      if (!(await this.sdk.hasValidCredentials())) {
        this.finishIfCurrent(generation, { status: 'unauthenticated' });
        return;
      }

      await this.getCredentials();
      const profile = await loadProfile();
      this.finishIfCurrent(generation, { profile, status: 'authenticated' });
    } catch (error: unknown) {
      await this.handleSessionFailure(error, generation);
    }
  }

  async login(loadProfile: ProfileLoader): Promise<void> {
    const generation = ++this.generation;
    this.transition({ status: 'authenticating' });

    try {
      const credentials = await this.sdk.authorize();

      if (generation !== this.generation) {
        await this.safeClearLocalCredentials();
        return;
      }

      this.accessToken = credentials;
      const profile = await loadProfile();
      this.finishIfCurrent(generation, { profile, status: 'authenticated' });
    } catch (error: unknown) {
      if (error instanceof SessionSdkError && error.code === 'cancelled') {
        this.finishIfCurrent(generation, { status: 'unauthenticated' });
        return;
      }

      await this.handleSessionFailure(error, generation);
    }
  }

  async refreshProfile(loadProfile: ProfileLoader): Promise<void> {
    if (this.snapshot.status !== 'authenticated' || this.snapshot.profile === undefined) {
      return;
    }

    const generation = this.generation;
    const currentProfile = this.snapshot.profile;
    this.transition({
      profile: currentProfile,
      profileRefreshStatus: 'refreshing',
      status: 'authenticated',
    });

    try {
      const profile = await loadProfile();
      this.finishIfCurrent(generation, {
        profile,
        profileRefreshStatus: 'succeeded',
        status: 'authenticated',
      });
    } catch (error: unknown) {
      await this.handleSessionFailure(error, generation);
    }
  }

  async logout(): Promise<void> {
    ++this.generation;
    this.cancelAuthenticatedRequests();
    this.accessToken = undefined;
    this.renewalFlight = undefined;
    this.transition({ status: 'unauthenticated' });
    await this.sdk.logout();
  }

  async getAccessToken(options: { forceRefresh?: boolean } = {}): Promise<string> {
    if (!canProvideToken(this.snapshot.status)) {
      throw new SessionSdkError('noCredentials');
    }

    const credentials = await this.getCredentials(options.forceRefresh ?? false);
    return credentials.accessToken;
  }

  registerAuthenticatedRequest(controller: AbortController): () => void {
    this.activeRequests.add(controller);
    return () => this.activeRequests.delete(controller);
  }

  private async getCredentials(forceRefresh = false): Promise<SessionCredentials> {
    if (!forceRefresh && this.accessToken !== undefined && isCredentialsUsable(this.accessToken)) {
      return this.accessToken;
    }

    if (this.renewalFlight === undefined) {
      const generation = this.generation;
      const renewal = this.sdk
        .getCredentials({ forceRefresh })
        .then((credentials) => {
          if (generation !== this.generation || !canProvideToken(this.snapshot.status)) {
            throw new SessionSdkError('noCredentials');
          }

          this.accessToken = credentials;
          return credentials;
        })
        .finally(() => {
          if (this.renewalFlight === renewal) {
            this.renewalFlight = undefined;
          }
        });

      this.renewalFlight = renewal;
    }

    return this.renewalFlight;
  }

  private async handleSessionFailure(error: unknown, generation: number): Promise<void> {
    this.cancelAuthenticatedRequests();

    if (isInvalidSession(error)) {
      this.accessToken = undefined;
      await this.safeClearLocalCredentials();
      this.finishIfCurrent(generation, { status: 'unauthenticated' });
      return;
    }

    this.finishIfCurrent(generation, {
      message: isNetworkFailure(error)
        ? 'No pudimos validar la sesión por un problema de red.'
        : 'No pudimos completar la autenticación de forma segura.',
      status: 'error',
    });
  }

  private async safeClearLocalCredentials(): Promise<void> {
    try {
      await this.sdk.clearLocalCredentials();
    } catch {
      // The coordinator still clears every in-memory reference and denies the session.
    }
  }

  private cancelAuthenticatedRequests(): void {
    for (const controller of this.activeRequests) {
      controller.abort();
    }

    this.activeRequests.clear();
  }

  private finishIfCurrent(generation: number, snapshot: SessionSnapshot): void {
    if (generation === this.generation) {
      this.transition(snapshot);
    }
  }

  private transition(snapshot: SessionSnapshot): void {
    this.snapshot = snapshot;

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
