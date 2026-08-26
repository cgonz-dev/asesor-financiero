import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { startSyntheticAuthServer, type SyntheticAuthServer } from '../../../test/synthetic-auth';
import { AccessTokenVerificationError } from '../application/access-token-verifier';
import {
  DEFAULT_JOSE_ACCESS_TOKEN_VERIFIER_OPTIONS,
  JoseAccessTokenVerifier,
  type JoseAccessTokenVerifierOptions,
} from './jose-access-token-verifier';

const TEST_OPTIONS = {
  ...DEFAULT_JOSE_ACCESS_TOKEN_VERIFIER_OPTIONS,
  cooldownMs: 0,
  timeoutMs: 100,
} satisfies JoseAccessTokenVerifierOptions;

describe('JoseAccessTokenVerifier', () => {
  let authServer: SyntheticAuthServer;

  beforeEach(async () => {
    authServer = await startSyntheticAuthServer();
  });

  afterEach(async () => {
    await authServer.close();
  });

  it('fails closed when Auth0 is intentionally unconfigured for public health/readiness startup', async () => {
    const verifier = new JoseAccessTokenVerifier(null, TEST_OPTIONS);

    await expect(verifier.verify(await authServer.sign())).rejects.toBeInstanceOf(
      AccessTokenVerificationError,
    );
  });

  it('accepts only a signed access token for the configured issuer and audience', async () => {
    const verifier = new JoseAccessTokenVerifier(authServer.configuration(), TEST_OPTIONS);
    const token = await authServer.sign();

    await expect(verifier.verify(token)).resolves.toEqual({
      identity: {
        issuer: authServer.issuer,
        provider: 'auth0',
        subject: 'auth0|synthetic-user',
      },
    });
  });

  it('reads only the configured verified-email claims for directed invitations', async () => {
    const verifier = new JoseAccessTokenVerifier(authServer.configuration(), TEST_OPTIONS);

    await expect(
      verifier.verify(
        await authServer.sign({ email: 'partner@example.test', emailVerified: true }),
      ),
    ).resolves.toEqual({
      identity: {
        email: 'partner@example.test',
        emailVerified: true,
        issuer: authServer.issuer,
        provider: 'auth0',
        subject: 'auth0|synthetic-user',
      },
    });
  });

  it.each([
    ['expired', () => authServer.sign({ expiresAt: Math.floor(Date.now() / 1_000) - 20 })],
    ['not active yet', () => authServer.sign({ notBefore: Math.floor(Date.now() / 1_000) + 20 })],
    ['wrong audience', () => authServer.sign({ audience: 'https://wrong.example.test' })],
    ['wrong issuer', () => authServer.sign({ issuer: 'https://wrong-issuer.example.test/' })],
    ['missing subject', () => authServer.sign({ subject: null })],
    ['missing key id', () => authServer.sign({ keyId: null })],
    ['ID token audience', () => authServer.sign({ audience: 'synthetic-native-client-id' })],
  ])('rejects a %s token without exposing the reason', async (_label, createToken) => {
    const verifier = new JoseAccessTokenVerifier(authServer.configuration(), TEST_OPTIONS);

    await expect(verifier.verify(await createToken())).rejects.toBeInstanceOf(
      AccessTokenVerificationError,
    );
  });

  it('rejects a manipulated signature', async () => {
    const verifier = new JoseAccessTokenVerifier(authServer.configuration(), TEST_OPTIONS);
    const token = await authServer.sign();
    const segments = token.split('.');
    const signature = segments[2] as string;
    const manipulated = `${segments[0]}.${segments[1]}.${signature.startsWith('a') ? 'b' : 'a'}${signature.slice(1)}`;

    await expect(verifier.verify(manipulated)).rejects.toBeInstanceOf(AccessTokenVerificationError);
  });

  it('rejects algorithms outside the RS256 allowlist before trusting claims', async () => {
    const jose = await import('jose');
    const secret = await jose.generateSecret('HS256');
    const now = Math.floor(Date.now() / 1_000);
    const token = await new jose.SignJWT({})
      .setProtectedHeader({ alg: 'HS256', kid: 'symmetric-key', typ: 'JWT' })
      .setIssuer(authServer.issuer)
      .setAudience(authServer.audience)
      .setSubject('auth0|synthetic-user')
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(secret);
    const verifier = new JoseAccessTokenVerifier(authServer.configuration(), TEST_OPTIONS);

    await expect(verifier.verify(token)).rejects.toBeInstanceOf(AccessTokenVerificationError);
  });

  it('fails closed for an unknown kid and refreshes JWKS once rotation is allowed', async () => {
    const verifier = new JoseAccessTokenVerifier(authServer.configuration(), TEST_OPTIONS);
    await verifier.verify(await authServer.sign());
    await authServer.createSigningKey('key-2', false);

    await expect(verifier.verify(await authServer.sign({ keyId: 'key-2' }))).rejects.toBeInstanceOf(
      AccessTokenVerificationError,
    );

    await authServer.createSigningKey('key-2', true);
    await expect(verifier.verify(await authServer.sign({ keyId: 'key-2' }))).resolves.toBeDefined();
    expect(authServer.jwksRequests()).toBeGreaterThanOrEqual(2);
  });

  it('uses a trusted cached key during a JWKS outage and fails closed without a cache', async () => {
    const token = await authServer.sign();
    const cachedVerifier = new JoseAccessTokenVerifier(authServer.configuration(), TEST_OPTIONS);
    await cachedVerifier.verify(token);
    const requestsAfterWarmup = authServer.jwksRequests();
    authServer.setOutage(true);

    await expect(cachedVerifier.verify(token)).resolves.toBeDefined();
    expect(authServer.jwksRequests()).toBe(requestsAfterWarmup);

    const coldVerifier = new JoseAccessTokenVerifier(authServer.configuration(), TEST_OPTIONS);
    await expect(coldVerifier.verify(token)).rejects.toBeInstanceOf(AccessTokenVerificationError);
  });

  it('applies a bounded timeout to JWKS retrieval', async () => {
    authServer.setDelay(100);
    const verifier = new JoseAccessTokenVerifier(authServer.configuration(), {
      ...TEST_OPTIONS,
      timeoutMs: 10,
    });

    await expect(verifier.verify(await authServer.sign())).rejects.toBeInstanceOf(
      AccessTokenVerificationError,
    );
  });
});
