export interface AuthConfiguration {
  audience: string;
  emailClaim: string;
  emailVerifiedClaim: string;
  issuer: string;
  jwksUrl: URL;
}

export function verifiedEmailClaimNames(audience: string): {
  emailClaim: string;
  emailVerifiedClaim: string;
} {
  const namespace = audience.replace(/\/+$/, '');

  return {
    emailClaim: `${namespace}/email`,
    emailVerifiedClaim: `${namespace}/email_verified`,
  };
}

function requiredEnvironmentValue(
  environment: NodeJS.ProcessEnv,
  name: 'AUTH0_AUDIENCE' | 'AUTH0_ISSUER',
): string {
  const value = environment[name]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`${name} is required to start the authenticated API.`);
  }

  return value;
}

export function authConfigurationFromEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
): AuthConfiguration | undefined {
  const hasIssuer = (environment.AUTH0_ISSUER?.trim().length ?? 0) > 0;
  const hasAudience = (environment.AUTH0_AUDIENCE?.trim().length ?? 0) > 0;

  if (!hasIssuer && !hasAudience) {
    return undefined;
  }

  const issuer = requiredEnvironmentValue(environment, 'AUTH0_ISSUER');
  const audience = requiredEnvironmentValue(environment, 'AUTH0_AUDIENCE');
  let issuerUrl: URL;

  try {
    issuerUrl = new URL(issuer);
  } catch {
    throw new Error(
      'AUTH0_ISSUER must be an exact HTTPS origin with a trailing slash and no path, query, fragment or credentials.',
    );
  }

  if (
    issuerUrl.protocol !== 'https:' ||
    issuerUrl.username.length > 0 ||
    issuerUrl.password.length > 0 ||
    issuerUrl.search.length > 0 ||
    issuerUrl.hash.length > 0 ||
    issuerUrl.pathname !== '/' ||
    issuerUrl.href !== issuer
  ) {
    throw new Error(
      'AUTH0_ISSUER must be an exact HTTPS origin with a trailing slash and no path, query, fragment or credentials.',
    );
  }

  return {
    audience,
    ...verifiedEmailClaimNames(audience),
    issuer,
    jwksUrl: new URL('.well-known/jwks.json', issuerUrl),
  };
}
