import type { INestApplication, NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import type { AuthConfiguration } from './auth/config/auth-configuration';
import { allowedCorsOriginsFromEnvironment } from './cors';
import { createOpenApiDocument } from './openapi/create-openapi-document';

export interface CreateApplicationOptions {
  authConfiguration?: AuthConfiguration;
  corsOrigins?: string[];
  databaseUrl?: string;
  docs?: boolean;
  logger?: NestApplicationOptions['logger'];
}

export async function createApplication(
  options: CreateApplicationOptions = {},
): Promise<INestApplication> {
  const app = await NestFactory.create(
    AppModule.register({
      ...(options.authConfiguration === undefined
        ? {}
        : { authConfiguration: options.authConfiguration }),
      ...(options.databaseUrl === undefined ? {} : { databaseUrl: options.databaseUrl }),
    }),
    {
      logger: options.logger ?? false,
    },
  );

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    allowedHeaders: ['Accept', 'Authorization', 'Content-Type'],
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
