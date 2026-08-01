import { z } from 'zod';

const healthResponseShape = {
  status: z.literal('ok').describe('The API process is healthy.'),
  service: z.literal('copiloto-financiero-api').describe('Stable service identifier.'),
  version: z.string().min(1).describe('Application version reported by the service.'),
} satisfies z.ZodRawShape;

/**
 * Canonical health shape. Server and client policies are derived from this one definition.
 */
export const HealthResponseSchema = z.object(healthResponseShape);

/**
 * Public server responses reject undeclared properties.
 */
export const HealthResponseServerSchema = HealthResponseSchema.strict();

/**
 * Clients accept and retain additional safe fields for forward compatibility.
 */
export const HealthResponseClientSchema = HealthResponseSchema.loose();

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const HEALTH_RESPONSE_EXAMPLE = {
  status: 'ok',
  service: 'copiloto-financiero-api',
  version: '0.1.0',
} as const satisfies HealthResponse;
