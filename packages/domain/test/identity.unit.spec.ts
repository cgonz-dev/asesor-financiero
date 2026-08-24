import { DomainValidationError, verifiedExternalIdentity } from '@copiloto/domain';
import { describe, expect, it } from 'vitest';

describe('verifiedExternalIdentity', () => {
  it('preserves an exact verified issuer and subject', () => {
    expect(
      verifiedExternalIdentity({
        issuer: 'https://identity.example.test/',
        subject: 'provider|person-a',
        provider: 'test-provider',
        email: 'person-a@example.test',
        emailVerified: true,
      }),
    ).toEqual({
      issuer: 'https://identity.example.test/',
      subject: 'provider|person-a',
      provider: 'test-provider',
      email: 'person-a@example.test',
      emailVerified: true,
    });
  });

  it('rejects verification metadata without an email', () => {
    expect(() =>
      verifiedExternalIdentity({
        issuer: 'https://identity.example.test/',
        subject: 'provider|person-a',
        provider: 'test-provider',
        emailVerified: true,
      }),
    ).toThrow(DomainValidationError);
  });
});
