import { Inject, Injectable } from '@nestjs/common';

import {
  ACCESS_TOKEN_VERIFIER,
  AccessTokenVerificationError,
  type AccessTokenVerifier,
  type VerifiedAccessToken,
} from '../application/access-token-verifier';
import type { AuthConfiguration } from '../config/auth-configuration';
import { AUTH_CONFIGURATION, JOSE_VERIFIER_OPTIONS } from '../tokens';

type JoseModule = typeof import('jose', { with: { 'resolution-mode': 'import' } });
type RemoteJwkSet = ReturnType<JoseModule['createRemoteJWKSet']>;

const ALLOWED_ALGORITHMS = ['RS256'] as const;
export interface JoseAccessTokenVerifierOptions {
  cacheMaxAgeMs: number;
  clockToleranceSeconds: number;
  cooldownMs: number;
  timeoutMs: number;
}

export const DEFAULT_JOSE_ACCESS_TOKEN_VERIFIER_OPTIONS = {
  cacheMaxAgeMs: 10 * 60 * 1_000,
  clockToleranceSeconds: 5,
  cooldownMs: 30 * 1_000,
  timeoutMs: 2 * 1_000,
} as const satisfies JoseAccessTokenVerifierOptions;

@Injectable()
export class JoseAccessTokenVerifier implements AccessTokenVerifier {
  private joseModule: Promise<JoseModule> | undefined;
  private remoteJwkSet: RemoteJwkSet | undefined;

  constructor(
    @Inject(AUTH_CONFIGURATION)
    private readonly configuration: AuthConfiguration | null,
    @Inject(JOSE_VERIFIER_OPTIONS)
    private readonly options: JoseAccessTokenVerifierOptions,
  ) {}

  async verify(accessToken: string): Promise<VerifiedAccessToken> {
    if (this.configuration === null) {
      throw new AccessTokenVerificationError();
    }

    try {
      const jose = await this.loadJose();
      const jwks = this.remoteJwkSet ?? this.createRemoteJwkSet(jose);
      const { payload, protectedHeader } = await jose.jwtVerify(accessToken, jwks, {
        algorithms: [...ALLOWED_ALGORITHMS],
        audience: this.configuration.audience,
        clockTolerance: this.options.clockToleranceSeconds,
        issuer: this.configuration.issuer,
        requiredClaims: ['iss', 'aud', 'exp', 'sub'],
      });

      if (
        protectedHeader.alg !== 'RS256' ||
        typeof protectedHeader.kid !== 'string' ||
        protectedHeader.kid.length === 0 ||
        (protectedHeader.typ !== undefined &&
          protectedHeader.typ !== 'JWT' &&
          protectedHeader.typ !== 'at+jwt') ||
        typeof payload.sub !== 'string' ||
        payload.sub.length === 0 ||
        payload.sub.trim() !== payload.sub
      ) {
        throw new AccessTokenVerificationError();
      }

      return {
        identity: {
          issuer: this.configuration.issuer,
          provider: 'auth0',
          subject: payload.sub,
        },
      };
    } catch (error: unknown) {
      if (error instanceof AccessTokenVerificationError) {
        throw error;
      }

      throw new AccessTokenVerificationError({ cause: error });
    }
  }

  private createRemoteJwkSet(jose: JoseModule): RemoteJwkSet {
    if (this.configuration === null) {
      throw new AccessTokenVerificationError();
    }

    this.remoteJwkSet = jose.createRemoteJWKSet(this.configuration.jwksUrl, {
      cacheMaxAge: this.options.cacheMaxAgeMs,
      cooldownDuration: this.options.cooldownMs,
      timeoutDuration: this.options.timeoutMs,
    });

    return this.remoteJwkSet;
  }

  private loadJose(): Promise<JoseModule> {
    this.joseModule ??= import('jose');
    return this.joseModule;
  }
}

export const JOSE_ACCESS_TOKEN_VERIFIER_PROVIDER = {
  provide: ACCESS_TOKEN_VERIFIER,
  useExisting: JoseAccessTokenVerifier,
};
