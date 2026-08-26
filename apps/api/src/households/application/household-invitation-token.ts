import { createHash, randomBytes } from 'node:crypto';

const INVITATION_TOKEN_BYTES = 32;

export interface GeneratedHouseholdInvitationToken {
  rawToken: string;
  tokenHash: Uint8Array;
}

export interface HouseholdInvitationTokenService {
  generate(): GeneratedHouseholdInvitationToken;
  hash(rawToken: string): Uint8Array;
}

export const HOUSEHOLD_INVITATION_TOKEN_SERVICE = Symbol('HOUSEHOLD_INVITATION_TOKEN_SERVICE');

export class NodeHouseholdInvitationTokenService implements HouseholdInvitationTokenService {
  generate(): GeneratedHouseholdInvitationToken {
    const rawToken = randomBytes(INVITATION_TOKEN_BYTES).toString('base64url');

    return { rawToken, tokenHash: this.hash(rawToken) };
  }

  hash(rawToken: string): Uint8Array {
    return createHash('sha256').update(rawToken, 'utf8').digest();
  }
}
