import {
  AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  CreateHouseholdRequestSchema,
  HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE,
  HOUSEHOLD_SUMMARY_EXAMPLE,
  HOUSEHOLD_VALIDATION_ERROR_EXAMPLE,
  HouseholdDetailServerSchema,
  HouseholdIdSchema,
  LIST_HOUSEHOLDS_RESPONSE_EXAMPLE,
  ListHouseholdsResponseServerSchema,
  type HouseholdDetail,
  type HouseholdSummary,
  type ListHouseholdsResponse,
} from '@copiloto/contracts';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { ZodSerializerDto } from 'nestjs-zod';

import { authenticatedUserContext } from '../../auth/http/authenticated-user-context';
import { AuthenticationErrorDto } from '../../auth/http/authentication-error.dto';
import { AuthenticationGuard } from '../../auth/http/authentication.guard';
import { CreateHousehold } from '../application/create-household';
import { GetHousehold } from '../application/get-household';
import { HouseholdNotFoundError } from '../application/errors';
import type { UserHousehold } from '../application/household-repository';
import { ListUserHouseholds } from '../application/list-user-households';
import {
  CreateHouseholdRequestDto,
  HouseholdDetailDto,
  HouseholdErrorDto,
  ListHouseholdsResponseDto,
} from './household.dto';

function householdSummary(context: UserHousehold): HouseholdSummary {
  return {
    id: context.household.id,
    membershipStatus: 'active',
    name: context.household.name,
    role: context.membership.role,
  };
}

@ApiTags('households')
@ApiBearerAuth('auth0')
@UseGuards(AuthenticationGuard)
@Controller('households')
export class HouseholdsController {
  constructor(
    @Inject(CreateHousehold)
    private readonly createHousehold: CreateHousehold,
    @Inject(GetHousehold)
    private readonly getHousehold: GetHousehold,
    @Inject(ListUserHouseholds)
    private readonly listUserHouseholds: ListUserHouseholds,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List active Households for the authenticated User' })
  @ApiOkResponse({
    description: 'Only active memberships for the authenticated User are returned.',
    type: ListHouseholdsResponseDto,
    example: LIST_HOUSEHOLDS_RESPONSE_EXAMPLE,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid access token for this API is required.',
    type: AuthenticationErrorDto,
    example: AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  })
  @ZodSerializerDto(ListHouseholdsResponseDto)
  async list(@Req() request: Request): Promise<ListHouseholdsResponse> {
    const { user } = authenticatedUserContext(request);
    const contexts = await this.listUserHouseholds.execute(user.id);

    return ListHouseholdsResponseServerSchema.parse({
      households: contexts.map(householdSummary),
    });
  }

  @Post()
  @ApiOperation({ summary: 'Create a Household with the authenticated User as Owner Active' })
  @ApiBody({ type: CreateHouseholdRequestDto })
  @ApiCreatedResponse({
    description: 'The Household and its single initial Owner Active membership were created.',
    type: HouseholdDetailDto,
    example: HOUSEHOLD_SUMMARY_EXAMPLE,
  })
  @ApiBadRequestResponse({
    description: 'The request body does not satisfy the shared Household contract.',
    type: HouseholdErrorDto,
    example: HOUSEHOLD_VALIDATION_ERROR_EXAMPLE,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid access token for this API is required.',
    type: AuthenticationErrorDto,
    example: AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  })
  @ZodSerializerDto(HouseholdDetailDto)
  async create(@Req() request: Request, @Body() body: unknown): Promise<HouseholdDetail> {
    const parsed = CreateHouseholdRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(HOUSEHOLD_VALIDATION_ERROR_EXAMPLE);
    }

    const { user } = authenticatedUserContext(request);
    const created = await this.createHousehold.execute({
      internalUserId: user.id,
      name: parsed.data.name,
    });

    return HouseholdDetailServerSchema.parse(householdSummary(created));
  }

  @Get(':householdId')
  @ApiOperation({ summary: 'Get an authorized Household basic profile' })
  @ApiParam({ name: 'householdId', format: 'uuid', type: String })
  @ApiOkResponse({
    description: 'The authenticated User has an active membership in the Household.',
    type: HouseholdDetailDto,
    example: HOUSEHOLD_SUMMARY_EXAMPLE,
  })
  @ApiNotFoundResponse({
    description: 'The Household does not exist or is not visible to the authenticated User.',
    type: HouseholdErrorDto,
    example: HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE,
  })
  @ApiUnauthorizedResponse({
    description: 'A valid access token for this API is required.',
    type: AuthenticationErrorDto,
    example: AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  })
  @ZodSerializerDto(HouseholdDetailDto)
  async get(
    @Req() request: Request,
    @Param('householdId') householdId: string,
  ): Promise<HouseholdDetail> {
    const parsedId = HouseholdIdSchema.safeParse(householdId);

    if (!parsedId.success) {
      throw new NotFoundException(HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE);
    }

    const { user } = authenticatedUserContext(request);

    try {
      const context = await this.getHousehold.execute({
        householdId: parsedId.data,
        internalUserId: user.id,
      });

      return HouseholdDetailServerSchema.parse(householdSummary(context));
    } catch (error: unknown) {
      if (error instanceof HouseholdNotFoundError) {
        throw new NotFoundException(HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE);
      }

      throw error;
    }
  }
}
