import { Global, Module, type DynamicModule } from '@nestjs/common';

import { databaseUrlFromEnvironment } from '../config/database-url';
import { PrismaService } from './prisma/prisma.service';
import { DATABASE_URL } from './tokens';

export interface PersistenceModuleOptions {
  databaseUrl?: string;
}

@Global()
@Module({})
export class PersistenceModule {
  static register(options: PersistenceModuleOptions = {}): DynamicModule {
    return {
      module: PersistenceModule,
      providers: [
        {
          provide: DATABASE_URL,
          useFactory: (): string => options.databaseUrl ?? databaseUrlFromEnvironment(),
        },
        PrismaService,
      ],
      exports: [PrismaService],
    };
  }
}
