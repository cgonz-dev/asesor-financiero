import { z } from 'zod';

const meResponseShape = {
  id: z.string().uuid().describe('Opaque internal User identifier.'),
  status: z.enum(['active', 'blocked']).describe('Current internal User status.'),
} satisfies z.ZodRawShape;

/** Canonical response for the authenticated User profile. */
export const MeResponseSchema = z.object(meResponseShape);

/** The API never serializes undeclared identity fields. */
export const MeResponseServerSchema = MeResponseSchema.strict();

/** Clients tolerate future safe additions while validating the known profile. */
export const MeResponseClientSchema = MeResponseSchema.loose();

export type MeResponse = z.infer<typeof MeResponseSchema>;

export const AuthenticationErrorCodeSchema = z.enum([
  'AUTHENTICATION_REQUIRED',
  'AUTHENTICATION_INVALID',
]);

const publicAuthenticationErrorShape = {
  code: AuthenticationErrorCodeSchema,
  message: z.string().min(1).describe('Safe, localizable public message.'),
} satisfies z.ZodRawShape;

/** Authentication errors are deliberately closed to avoid leaking provider details. */
export const PublicAuthenticationErrorSchema = z.object(publicAuthenticationErrorShape).strict();

export type AuthenticationErrorCode = z.infer<typeof AuthenticationErrorCodeSchema>;
export type PublicAuthenticationError = z.infer<typeof PublicAuthenticationErrorSchema>;

export const ME_RESPONSE_EXAMPLE = {
  id: '11111111-1111-4111-8111-111111111111',
  status: 'active',
} as const satisfies MeResponse;

export const AUTHENTICATION_REQUIRED_ERROR_EXAMPLE = {
  code: 'AUTHENTICATION_REQUIRED',
  message: 'Se requiere una sesión válida.',
} as const satisfies PublicAuthenticationError;

export const AUTHENTICATION_INVALID_ERROR_EXAMPLE = {
  code: 'AUTHENTICATION_INVALID',
  message: 'La sesión no es válida o ya no está disponible.',
} as const satisfies PublicAuthenticationError;
