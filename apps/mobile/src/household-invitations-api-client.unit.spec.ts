import { describe, expect, it, vi } from 'vitest';

import type { TokenProvider } from './auth/token-provider';
import { HouseholdInvitationsApiClient } from './household-invitations-api-client';

const HOUSEHOLD_ID = '22222222-2222-4222-8222-222222222222';
const INVITATION_ID = '33333333-3333-4333-8333-333333333333';
const INVITATION_TOKEN = 'A'.repeat(43);
const INVITATION = {
  createdAt: '2026-08-25T18:00:00.000Z',
  expiresAt: '2026-09-01T18:00:00.000Z',
  id: INVITATION_ID,
  status: 'pending',
  targetEmailHint: 'p***@example.test',
} as const;

function tokenProvider(): TokenProvider {
  return {
    getAccessToken: vi.fn(async () => 'access.token'),
    invalidateSession: vi.fn(async () => undefined),
    registerAuthenticatedRequest: () => () => undefined,
  };
}

describe('HouseholdInvitationsApiClient', () => {
  it('sends the directed create request and accepts the one-time token response', async () => {
    const transport = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe(`https://api.example.test/api/v1/households/${HOUSEHOLD_ID}/invitations`);
      expect(new Headers(init.headers).get('authorization')).toBe('Bearer access.token');
      expect(JSON.parse(String(init.body))).toEqual({ targetEmail: 'partner@example.test' });
      return new Response(
        JSON.stringify({ invitation: INVITATION, invitationToken: INVITATION_TOKEN }),
        { status: 201 },
      );
    });
    const client = new HouseholdInvitationsApiClient({
      baseUrl: 'https://api.example.test',
      tokenProvider: tokenProvider(),
      transport,
    });

    await expect(
      client.create(HOUSEHOLD_ID, { targetEmail: ' Partner@Example.Test ' }),
    ).resolves.toEqual({ invitation: INVITATION, invitationToken: INVITATION_TOKEN });
  });

  it('puts the raw invitation token only in the acceptance POST body', async () => {
    const transport = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://api.example.test/api/v1/invitations/accept');
      expect(url).not.toContain(INVITATION_TOKEN);
      expect(JSON.parse(String(init.body))).toEqual({ invitationToken: INVITATION_TOKEN });
      return new Response(
        JSON.stringify({
          household: {
            id: HOUSEHOLD_ID,
            membershipStatus: 'active',
            name: 'Hogar compartido',
            role: 'member',
          },
        }),
        { status: 200 },
      );
    });
    const client = new HouseholdInvitationsApiClient({
      baseUrl: 'https://api.example.test',
      tokenProvider: tokenProvider(),
      transport,
    });

    await expect(client.accept({ invitationToken: INVITATION_TOKEN })).resolves.toMatchObject({
      household: { id: HOUSEHOLD_ID, role: 'member' },
    });
  });

  it('lists minimal members and revokes by non-secret invitation ID', async () => {
    const transport = vi.fn(async (url: string) => {
      if (url.endsWith('/members')) {
        return new Response(JSON.stringify({ members: [{ isCurrentUser: true, role: 'owner' }] }));
      }

      expect(url).toBe(
        `https://api.example.test/api/v1/households/${HOUSEHOLD_ID}/invitations/${INVITATION_ID}/revoke`,
      );
      return new Response(JSON.stringify({ invitation: { ...INVITATION, status: 'revoked' } }));
    });
    const client = new HouseholdInvitationsApiClient({
      baseUrl: 'https://api.example.test',
      tokenProvider: tokenProvider(),
      transport,
    });

    await expect(client.listMembers(HOUSEHOLD_ID)).resolves.toEqual({
      members: [{ isCurrentUser: true, role: 'owner' }],
    });
    await expect(client.revoke(HOUSEHOLD_ID, INVITATION_ID)).resolves.toMatchObject({
      invitation: { status: 'revoked' },
    });
  });

  it('rejects malformed responses instead of trusting transport data', async () => {
    const client = new HouseholdInvitationsApiClient({
      baseUrl: 'https://api.example.test',
      tokenProvider: tokenProvider(),
      transport: vi.fn(async () => new Response(JSON.stringify({ tokenHash: 'private' }))),
    });

    await expect(client.list(HOUSEHOLD_ID)).rejects.toMatchObject({ code: 'invalidResponse' });
  });
});
