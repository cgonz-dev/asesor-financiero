import { Module, type DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ZodSerializerInterceptor } from 'nestjs-zod';

import { AuthModule } from './auth/auth.module';
import type { AuthConfiguration } from './auth/config/auth-configuration';
import { HealthController } from './health/health.controller';
import { HouseholdsModule } from './households/households.module';
import { PersistenceModule } from './persistence/persistence.module';
import { ReadinessModule } from './readiness/readiness.module';

export interface AppModuleOptions {
  authConfiguration?: AuthConfiguration;
  databaseUrl?: string;
}

@Module({})
export class AppModule {
  static register(options: AppModuleOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        PersistenceModule.register(
          options.databaseUrl === undefined ? {} : { databaseUrl: options.databaseUrl },
        ),
        AuthModule.register(
          options.authConfiguration === undefined
            ? {}
            : { configuration: options.authConfiguration },
        ),
        HouseholdsModule,
        ReadinessModule,
      ],
      controllers: [HealthController],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: ZodSerializerInterceptor,
        },
      ],
    };
  }
}
