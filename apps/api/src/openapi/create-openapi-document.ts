import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import { cleanupOpenApiDoc } from 'nestjs-zod';

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Copiloto Financiero API')
    .setDescription('API bootstrap contract. It contains no financial operations.')
    .setVersion('0.1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  const cleanedDocument = cleanupOpenApiDoc(document, { version: '3.1' });

  return {
    ...cleanedDocument,
    openapi: '3.1.0',
  };
}
