import { Module, type DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ZodSerializerInterceptor } from 'nestjs-zod';

import { HealthController } from './health/health.controller';
import { HouseholdsModule } from './households/households.module';
import { IdentityModule } from './identity/identity.module';
import { PersistenceModule } from './persistence/persistence.module';
import { ReadinessModule } from './readiness/readiness.module';

export interface AppModuleOptions {
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
        IdentityModule,
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
