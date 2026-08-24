import {
  READINESS_NOT_READY_RESPONSE_EXAMPLE,
  READINESS_READY_RESPONSE_EXAMPLE,
  type ReadinessResponse,
} from '@copiloto/contracts';
import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodSerializerDto } from 'nestjs-zod';

import { ReadinessResponseDto } from './readiness-response.dto';
import { ReadinessService } from './readiness.service';

@ApiTags('readiness')
@Controller('readiness')
export class ReadinessController {
  constructor(
    @Inject(ReadinessService)
    private readonly readiness: ReadinessService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Report whether the API can use its required infrastructure' })
  @ApiOkResponse({
    description: 'The API can use its required infrastructure.',
    type: ReadinessResponseDto,
    example: READINESS_READY_RESPONSE_EXAMPLE,
  })
  @ApiServiceUnavailableResponse({
    description: 'The API cannot currently use its required infrastructure.',
    type: ReadinessResponseDto,
    example: READINESS_NOT_READY_RESPONSE_EXAMPLE,
  })
  @ZodSerializerDto(ReadinessResponseDto)
  async getReadiness(@Res({ passthrough: true }) response: Response): Promise<ReadinessResponse> {
    const result = await this.readiness.check();

    if (result.status === 'notReady') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
