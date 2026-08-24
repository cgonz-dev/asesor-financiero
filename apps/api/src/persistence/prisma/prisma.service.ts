import 'dotenv/config';

import { PrismaPg } from '@prisma/adapter-pg';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';

import { PrismaClient } from '../../generated/prisma/client';
import { DATABASE_URL } from '../tokens';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(DATABASE_URL) databaseUrl: string) {
    const adapter = new PrismaPg({
      connectionString: databaseUrl,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 30_000,
      max: 10,
    });

    super({ adapter });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
