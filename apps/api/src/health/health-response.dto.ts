import { HealthResponseServerSchema } from '@copiloto/contracts';
import { createZodDto } from 'nestjs-zod';

/**
 * Thin Nest/OpenAPI adapter generated from the framework-independent shared schema.
 */
export class HealthResponseDto extends createZodDto(HealthResponseServerSchema) {}
