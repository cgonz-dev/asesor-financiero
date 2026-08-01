export const DEFAULT_ALLOWED_CORS_ORIGINS = [
  'http://localhost:8081',
  'http://127.0.0.1:8081',
] as const;

export function allowedCorsOriginsFromEnvironment(
  configuredOrigins = process.env.CORS_ALLOWED_ORIGINS,
): string[] {
  const parsedOrigins = configuredOrigins
    ?.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  return parsedOrigins === undefined || parsedOrigins.length === 0
    ? [...DEFAULT_ALLOWED_CORS_ORIGINS]
    : [...new Set(parsedOrigins)];
}
