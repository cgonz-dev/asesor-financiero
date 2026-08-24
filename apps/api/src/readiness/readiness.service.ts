import {
  READINESS_NOT_READY_RESPONSE_EXAMPLE,
  READINESS_READY_RESPONSE_EXAMPLE,
  ReadinessResponseServerSchema,
  type ReadinessResponse,
} from '@copiloto/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { PrismaService } from '../persistence/prisma/prisma.service';

@Injectable()
export class ReadinessService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  async check(): Promise<ReadinessResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return ReadinessResponseServerSchema.parse(READINESS_READY_RESPONSE_EXAMPLE);
    } catch {
      return ReadinessResponseServerSchema.parse(READINESS_NOT_READY_RESPONSE_EXAMPLE);
    }
  }
}
