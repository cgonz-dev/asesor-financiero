import {
  AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  ME_RESPONSE_EXAMPLE,
  MeResponseServerSchema,
  type MeResponse,
} from '@copiloto/contracts';
import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodSerializerDto } from 'nestjs-zod';

import { authenticatedUserContext } from './authenticated-user-context';
import { AuthenticationErrorDto } from './authentication-error.dto';
import { AuthenticationGuard } from './authentication.guard';
import { MeResponseDto } from './me-response.dto';

@ApiTags('identity')
@Controller('me')
export class MeController {
  @Get()
  @UseGuards(AuthenticationGuard)
  @ApiBearerAuth('auth0')
  @ApiOperation({ summary: 'Return the minimal authenticated internal User profile' })
  @ApiOkResponse({
    description: 'The access token maps to an active internal User.',
    type: MeResponseDto,
    example: ME_RESPONSE_EXAMPLE,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid access token for this API is required.',
    type: AuthenticationErrorDto,
    example: AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  })
  @ZodSerializerDto(MeResponseDto)
  getMe(@Req() request: Request): MeResponse {
    const { user } = authenticatedUserContext(request);

    return MeResponseServerSchema.parse({
      id: user.id,
      status: user.status,
    });
  }
}
