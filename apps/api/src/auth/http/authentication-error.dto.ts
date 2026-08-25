import { PublicAuthenticationErrorSchema } from '@copiloto/contracts';
import { createZodDto } from 'nestjs-zod';

export class AuthenticationErrorDto extends createZodDto(PublicAuthenticationErrorSchema) {}
