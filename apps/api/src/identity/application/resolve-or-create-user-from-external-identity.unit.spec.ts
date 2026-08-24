import { UserStatus, type VerifiedExternalIdentity } from '@copiloto/domain';
import { describe, expect, it, vi } from 'vitest';

import type { IdentityRepository, InternalUser } from './identity-repository';
import { ResolveOrCreateUserFromExternalIdentity } from './resolve-or-create-user-from-external-identity';

const verifiedIdentity = {
  issuer: 'https://identity.example.test/',
  subject: 'provider|person-a',
  provider: 'test-provider',
  email: 'person-a@example.test',
  emailVerified: true,
} as const satisfies VerifiedExternalIdentity;

describe('ResolveOrCreateUserFromExternalIdentity', () => {
  it('delegates only a validated, already verified stable identity', async () => {
    const user: InternalUser = {
      id: '018f85d7-6b2a-7f25-bfd0-554a23d4b65a',
      status: UserStatus.Active,
      createdAt: new Date('2026-08-13T00:00:00.000Z'),
      updatedAt: new Date('2026-08-13T00:00:00.000Z'),
    };
    const resolveOrCreate = vi.fn<IdentityRepository['resolveOrCreate']>().mockResolvedValue(user);
    const useCase = new ResolveOrCreateUserFromExternalIdentity({ resolveOrCreate });

    await expect(useCase.execute(verifiedIdentity)).resolves.toBe(user);
    expect(resolveOrCreate).toHaveBeenCalledOnce();
    expect(resolveOrCreate).toHaveBeenCalledWith(verifiedIdentity);
  });

  it('rejects malformed identity claims before calling persistence', async () => {
    const resolveOrCreate = vi.fn<IdentityRepository['resolveOrCreate']>();
    const useCase = new ResolveOrCreateUserFromExternalIdentity({ resolveOrCreate });

    expect(() =>
      useCase.execute({
        issuer: ' https://identity.example.test/',
        subject: 'provider|person-a',
        provider: 'test-provider',
      }),
    ).toThrow();
    expect(resolveOrCreate).not.toHaveBeenCalled();
  });
});
