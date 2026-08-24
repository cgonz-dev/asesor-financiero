import { z } from 'zod';

const readinessResponseShape = {
  status: z
    .enum(['ready', 'notReady'])
    .describe('Whether the API can serve requests that depend on its infrastructure.'),
  service: z.literal('copiloto-financiero-api').describe('Stable service identifier.'),
} satisfies z.ZodRawShape;

/**
 * Canonical readiness shape. It intentionally excludes infrastructure and error details.
 */
export const ReadinessResponseSchema = z.object(readinessResponseShape);

/**
 * Public server responses reject undeclared properties.
 */
export const ReadinessResponseServerSchema = ReadinessResponseSchema.strict();

/**
 * Clients accept and retain additional safe fields for forward compatibility.
 */
export const ReadinessResponseClientSchema = ReadinessResponseSchema.loose();

export type ReadinessResponse = z.infer<typeof ReadinessResponseSchema>;

export const READINESS_READY_RESPONSE_EXAMPLE = {
  status: 'ready',
  service: 'copiloto-financiero-api',
} as const satisfies ReadinessResponse;

export const READINESS_NOT_READY_RESPONSE_EXAMPLE = {
  status: 'notReady',
  service: 'copiloto-financiero-api',
} as const satisfies ReadinessResponse;
