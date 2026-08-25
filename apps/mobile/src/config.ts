const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const AUTH0_CUSTOM_SCHEME = 'copilotofinanciero';

export interface Auth0Configuration {
  audience: string;
  clientId: string;
  customScheme: string;
  domain: string;
}

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  return configuredUrl === undefined || configuredUrl.length === 0
    ? DEFAULT_API_BASE_URL
    : configuredUrl;
}

export function getAuth0Configuration(): Auth0Configuration | null {
  const domain = process.env.EXPO_PUBLIC_AUTH0_DOMAIN?.trim();
  const clientId = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID?.trim();
  const audience = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE?.trim();
  const values = [domain, clientId, audience];

  if (values.every((value) => value === undefined || value.length === 0)) {
    return null;
  }

  if (values.some((value) => value === undefined || value.length === 0)) {
    throw new Error('Auth0 mobile configuration is incomplete.');
  }

  if (!/^[a-z0-9.-]+$/.test(domain as string)) {
    throw new Error('EXPO_PUBLIC_AUTH0_DOMAIN must be a lowercase hostname without a scheme.');
  }

  return {
    audience: audience as string,
    clientId: clientId as string,
    customScheme: AUTH0_CUSTOM_SCHEME,
    domain: domain as string,
  };
}
