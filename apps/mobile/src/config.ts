const DEFAULT_API_BASE_URL = 'http://localhost:3000';

export function getApiBaseUrl(): string {
  const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

  return configuredUrl === undefined || configuredUrl.length === 0
    ? DEFAULT_API_BASE_URL
    : configuredUrl;
}
