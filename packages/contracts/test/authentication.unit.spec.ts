import { describe, expect, it } from 'vitest';

import {
  AUTHENTICATION_INVALID_ERROR_EXAMPLE,
  ME_RESPONSE_EXAMPLE,
  MeResponseClientSchema,
  MeResponseServerSchema,
  PublicAuthenticationErrorSchema,
} from '../src';

describe('authentication contracts', () => {
  it('validates the minimal /me response', () => {
    expect(MeResponseServerSchema.parse(ME_RESPONSE_EXAMPLE)).toEqual(ME_RESPONSE_EXAMPLE);
  });

  it('rejects undeclared identity fields on the server', () => {
    expect(() =>
      MeResponseServerSchema.parse({
        ...ME_RESPONSE_EXAMPLE,
        issuer: 'https://identity.example.test/',
        subject: 'provider|person',
      }),
    ).toThrow();
  });

  it('allows safe additive /me fields on the client', () => {
    expect(
      MeResponseClientSchema.parse({ ...ME_RESPONSE_EXAMPLE, displayName: 'Persona ficticia' }),
    ).toMatchObject(ME_RESPONSE_EXAMPLE);
  });

  it('keeps public authentication errors closed', () => {
    expect(PublicAuthenticationErrorSchema.parse(AUTHENTICATION_INVALID_ERROR_EXAMPLE)).toEqual(
      AUTHENTICATION_INVALID_ERROR_EXAMPLE,
    );
    expect(() =>
      PublicAuthenticationErrorSchema.parse({
        ...AUTHENTICATION_INVALID_ERROR_EXAMPLE,
        issuer: 'https://tenant.example.test/',
      }),
    ).toThrow();
  });
});
