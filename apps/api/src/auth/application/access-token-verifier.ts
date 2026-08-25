import type { VerifiedExternalIdentity } from '@copiloto/domain';

export interface VerifiedAccessToken {
  identity: VerifiedExternalIdentity;
}

export interface AccessTokenVerifier {
  verify(accessToken: string): Promise<VerifiedAccessToken>;
}

export const ACCESS_TOKEN_VERIFIER = Symbol('ACCESS_TOKEN_VERIFIER');

export class AccessTokenVerificationError extends Error {
  constructor(options: { cause?: unknown } = {}) {
    super(
      'The access token could not be verified.',
      options.cause === undefined ? undefined : { cause: options.cause },
    );
    this.name = 'AccessTokenVerificationError';
  }
}
