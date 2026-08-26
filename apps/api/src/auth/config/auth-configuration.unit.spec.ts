import { afterEach, describe, expect, it } from 'vitest';

import { authConfigurationFromEnvironment } from './auth-configuration';

const originalIssuer = process.env.AUTH0_ISSUER;
const originalAudience = process.env.AUTH0_AUDIENCE;

afterEach(() => {
  if (originalIssuer === undefined) {
    delete process.env.AUTH0_ISSUER;
  } else {
    process.env.AUTH0_ISSUER = originalIssuer;
  }

  if (originalAudience === undefined) {
    delete process.env.AUTH0_AUDIENCE;
  } else {
    process.env.AUTH0_AUDIENCE = originalAudience;
  }
});

describe('authConfigurationFromEnvironment', () => {
  it('allows public health/readiness startup without an auth bypass when both values are absent', () => {
    expect(authConfigurationFromEnvironment({})).toBeUndefined();
  });

  it.each([
    [{ AUTH0_ISSUER: 'https://tenant.example.test/' }],
    [{ AUTH0_AUDIENCE: 'https://api.example.test' }],
  ])('rejects partial Auth0 configuration: %j', (environment) => {
    expect(() => authConfigurationFromEnvironment(environment)).toThrow();
  });

  it('derives a fixed JWKS URL from the exact configured issuer', () => {
    process.env.AUTH0_ISSUER = 'https://tenant.example.test/';
    process.env.AUTH0_AUDIENCE = 'https://api.example.test';

    expect(authConfigurationFromEnvironment()).toEqual({
      audience: 'https://api.example.test',
      emailClaim: 'https://api.example.test/email',
      emailVerifiedClaim: 'https://api.example.test/email_verified',
      issuer: 'https://tenant.example.test/',
      jwksUrl: new URL('https://tenant.example.test/.well-known/jwks.json'),
    });
  });

  it.each([
    'http://tenant.example.test/',
    'https://tenant.example.test',
    'https://tenant.example.test/path/',
    'https://tenant.example.test/?issuer=dynamic',
    'not a URL that should be echoed',
  ])('rejects a non-canonical or unsafe issuer: %s', (issuer) => {
    process.env.AUTH0_ISSUER = issuer;
    process.env.AUTH0_AUDIENCE = 'https://api.example.test';

    expect(() => authConfigurationFromEnvironment()).toThrow();
  });
});
