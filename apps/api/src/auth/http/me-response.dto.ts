import { MeResponseServerSchema } from '@copiloto/contracts';
import { createZodDto } from 'nestjs-zod';

export class MeResponseDto extends createZodDto(MeResponseServerSchema) {}
