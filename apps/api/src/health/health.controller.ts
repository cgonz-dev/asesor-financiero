import {
  HEALTH_RESPONSE_EXAMPLE,
  HealthResponseServerSchema,
  type HealthResponse,
} from '@copiloto/contracts';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodSerializerDto } from 'nestjs-zod';

import { HealthResponseDto } from './health-response.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Report API process health' })
  @ApiOkResponse({
    description: 'The API process is healthy.',
    type: HealthResponseDto,
    example: HEALTH_RESPONSE_EXAMPLE,
  })
  @ZodSerializerDto(HealthResponseDto)
  getHealth(): HealthResponse {
    return HealthResponseServerSchema.parse(HEALTH_RESPONSE_EXAMPLE);
  }
}
