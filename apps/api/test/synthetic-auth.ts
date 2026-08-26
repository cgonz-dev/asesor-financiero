import { createServer, type Server } from 'node:http';

import {
  type AuthConfiguration,
  verifiedEmailClaimNames,
} from '../src/auth/config/auth-configuration';

type JoseModule = typeof import('jose', { with: { 'resolution-mode': 'import' } });
type KeyPair = Awaited<ReturnType<JoseModule['generateKeyPair']>>;

export interface SyntheticTokenOptions {
  audience?: string;
  email?: string;
  emailVerified?: boolean;
  expiresAt?: number;
  issuer?: string;
  keyId?: string | null;
  notBefore?: number;
  subject?: string | null;
  type?: string;
}

export interface SyntheticAuthServer {
  audience: string;
  close(): Promise<void>;
  configuration(): AuthConfiguration;
  createSigningKey(keyId: string, publish?: boolean): Promise<void>;
  issuer: string;
  jwksRequests(): number;
  setDelay(delayMs: number): void;
  setOutage(outage: boolean): void;
  sign(options?: SyntheticTokenOptions): Promise<string>;
}

export async function startSyntheticAuthServer(): Promise<SyntheticAuthServer> {
  const jose = await import('jose');
  const keys = new Map<
    string,
    { pair: KeyPair; publicJwk: Record<string, unknown>; published: boolean }
  >();
  let delayMs = 0;
  let outage = false;
  let requests = 0;

  const createSigningKey = async (keyId: string, publish = true): Promise<void> => {
    const pair = await jose.generateKeyPair('RS256');
    const exported = await jose.exportJWK(pair.publicKey);
    keys.set(keyId, {
      pair,
      publicJwk: {
        ...exported,
        alg: 'RS256',
        kid: keyId,
        use: 'sig',
      },
      published: publish,
    });
  };

  await createSigningKey('key-1');

  const server: Server = createServer((request, response) => {
    if (request.url !== '/.well-known/jwks.json') {
      response.writeHead(404).end();
      return;
    }

    requests += 1;

    const reply = () => {
      if (outage) {
        response.writeHead(503, { 'content-type': 'application/json' }).end('{}');
        return;
      }

      const publicKeys = [...keys.values()]
        .filter(({ published }) => published)
        .map(({ publicJwk }) => publicJwk);
      response
        .writeHead(200, { 'content-type': 'application/json' })
        .end(JSON.stringify({ keys: publicKeys }));
    };

    if (delayMs > 0) {
      setTimeout(reply, delayMs);
    } else {
      reply();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('Synthetic JWKS server did not expose a TCP port.');
  }

  const issuer = `http://127.0.0.1:${address.port}/`;
  const audience = 'https://api.copiloto.example.test';
  const emailClaims = verifiedEmailClaimNames(audience);

  return {
    audience,
    issuer,
    configuration: () => ({
      audience,
      ...emailClaims,
      issuer,
      jwksUrl: new URL('.well-known/jwks.json', issuer),
    }),
    createSigningKey,
    jwksRequests: () => requests,
    setDelay: (nextDelayMs) => {
      delayMs = nextDelayMs;
    },
    setOutage: (nextOutage) => {
      outage = nextOutage;
    },
    sign: async (options = {}) => {
      const signingKeyId = options.keyId === null ? 'key-1' : (options.keyId ?? 'key-1');
      const key = keys.get(signingKeyId);

      if (key === undefined) {
        throw new Error(`Unknown synthetic signing key: ${signingKeyId}`);
      }

      const now = Math.floor(Date.now() / 1_000);
      const tokenAudience = options.audience ?? audience;
      const tokenEmailClaims = verifiedEmailClaimNames(tokenAudience);
      let token = new jose.SignJWT({
        ...(options.email === undefined
          ? {}
          : {
              [tokenEmailClaims.emailClaim]: options.email,
              [tokenEmailClaims.emailVerifiedClaim]: options.emailVerified ?? false,
            }),
      })
        .setProtectedHeader({
          alg: 'RS256',
          ...(options.keyId === null ? {} : { kid: signingKeyId }),
          typ: options.type ?? 'JWT',
        })
        .setIssuedAt(now)
        .setIssuer(options.issuer ?? issuer)
        .setAudience(tokenAudience)
        .setExpirationTime(options.expiresAt ?? now + 300);

      if (options.subject !== null) {
        token = token.setSubject(options.subject ?? 'auth0|synthetic-user');
      }

      if (options.notBefore !== undefined) {
        token = token.setNotBefore(options.notBefore);
      }

      return token.sign(key.pair.privateKey);
    },
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
    },
  };
}
