import type { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { allowedCorsOriginsFromEnvironment } from './cors';
import { createOpenApiDocument } from './openapi/create-openapi-document';

export interface CreateApplicationOptions {
  corsOrigins?: string[];
  databaseUrl?: string;
  docs?: boolean;
  logger?: NestApplicationOptions['logger'];
}

export async function createApplication(
  options: CreateApplicationOptions = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(
    AppModule.register(
      options.databaseUrl === undefined ? {} : { databaseUrl: options.databaseUrl },
    ),
    {
      logger: options.logger ?? false,
    },
  );

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    allowedHeaders: ['Accept', 'Content-Type'],
    credentials: false,
    methods: ['GET', 'OPTIONS'],
    optionsSuccessStatus: 204,
    origin: options.corsOrigins ?? allowedCorsOriginsFromEnvironment(),
  });

  if (options.docs ?? true) {
    SwaggerModule.setup('api/docs', app, createOpenApiDocument(app));
  }

  return app;
}
