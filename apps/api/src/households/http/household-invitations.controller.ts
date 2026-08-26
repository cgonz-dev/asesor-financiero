import {
  AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  AcceptHouseholdInvitationRequestSchema,
  AcceptHouseholdInvitationResponseServerSchema,
  CREATE_HOUSEHOLD_INVITATION_RESPONSE_EXAMPLE,
  CreateHouseholdInvitationRequestSchema,
  CreateHouseholdInvitationResponseServerSchema,
  HOUSEHOLD_FORBIDDEN_ERROR_EXAMPLE,
  HOUSEHOLD_INVITATION_NOT_FOUND_ERROR_EXAMPLE,
  HOUSEHOLD_INVITATION_UNAVAILABLE_ERROR_EXAMPLE,
  HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE,
  HOUSEHOLD_VALIDATION_ERROR_EXAMPLE,
  HouseholdIdSchema,
  HouseholdInvitationIdSchema,
  HouseholdInvitationSummaryServerSchema,
  LIST_HOUSEHOLD_INVITATIONS_RESPONSE_EXAMPLE,
  LIST_HOUSEHOLD_MEMBERS_RESPONSE_EXAMPLE,
  ListHouseholdInvitationsResponseServerSchema,
  ListHouseholdMembersResponseServerSchema,
  RevokeHouseholdInvitationResponseServerSchema,
  type AcceptHouseholdInvitationResponse,
  type CreateHouseholdInvitationResponse,
  type HouseholdInvitationSummary,
  type HouseholdSummary,
  type ListHouseholdInvitationsResponse,
  type ListHouseholdMembersResponse,
  type RevokeHouseholdInvitationResponse,
} from '@copiloto/contracts';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
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
import { AcceptHouseholdInvitation } from '../application/accept-household-invitation';
import {
  type HouseholdInvitationView,
  CreateHouseholdInvitation,
} from '../application/create-household-invitation';
import {
  HouseholdForbiddenError,
  HouseholdInvitationNotFoundError,
  HouseholdInvitationUnavailableError,
  HouseholdNotFoundError,
} from '../application/errors';
import { ListHouseholdInvitations } from '../application/list-household-invitations';
import { ListHouseholdMembers } from '../application/list-household-members';
import type { UserHousehold } from '../application/household-repository';
import { RevokeHouseholdInvitation } from '../application/revoke-household-invitation';
import {
  AcceptHouseholdInvitationRequestDto,
  AcceptHouseholdInvitationResponseDto,
  CreateHouseholdInvitationRequestDto,
  CreateHouseholdInvitationResponseDto,
  HouseholdErrorDto,
  ListHouseholdInvitationsResponseDto,
  ListHouseholdMembersResponseDto,
  RevokeHouseholdInvitationResponseDto,
} from './household.dto';

function householdSummary(context: UserHousehold): HouseholdSummary {
  return {
    id: context.household.id,
    membershipStatus: 'active',
    name: context.household.name,
    role: context.membership.role,
  };
}

function targetEmailHint(email: string): string {
  const separator = email.lastIndexOf('@');
  const local = email.slice(0, separator);
  const domain = email.slice(separator + 1);

  return `${local.slice(0, 1)}***@${domain}`;
}

function invitationSummary(view: HouseholdInvitationView): HouseholdInvitationSummary {
  return HouseholdInvitationSummaryServerSchema.parse({
    createdAt: view.invitation.createdAt.toISOString(),
    expiresAt: view.invitation.expiresAt.toISOString(),
    id: view.invitation.id,
    status: view.status,
    targetEmailHint: targetEmailHint(view.invitation.targetEmail),
  });
}

function throwPublicHouseholdError(error: unknown): never {
  if (error instanceof HouseholdForbiddenError) {
    throw new ForbiddenException(HOUSEHOLD_FORBIDDEN_ERROR_EXAMPLE);
  }

  if (error instanceof HouseholdInvitationUnavailableError) {
    throw new ConflictException(HOUSEHOLD_INVITATION_UNAVAILABLE_ERROR_EXAMPLE);
  }

  if (error instanceof HouseholdInvitationNotFoundError) {
    throw new NotFoundException(HOUSEHOLD_INVITATION_NOT_FOUND_ERROR_EXAMPLE);
  }

  if (error instanceof HouseholdNotFoundError) {
    throw new NotFoundException(HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE);
  }

  throw error;
}

@ApiTags('household invitations')
@ApiBearerAuth('auth0')
@UseGuards(AuthenticationGuard)
@Controller()
export class HouseholdInvitationsController {
  constructor(
    @Inject(CreateHouseholdInvitation)
    private readonly createInvitation: CreateHouseholdInvitation,
    @Inject(ListHouseholdInvitations)
    private readonly listInvitations: ListHouseholdInvitations,
    @Inject(RevokeHouseholdInvitation)
    private readonly revokeInvitation: RevokeHouseholdInvitation,
    @Inject(AcceptHouseholdInvitation)
    private readonly acceptInvitation: AcceptHouseholdInvitation,
    @Inject(ListHouseholdMembers)
    private readonly listMembers: ListHouseholdMembers,
  ) {}

  @Post('households/:householdId/invitations')
  @ApiOperation({ summary: 'Create a directed single-use invitation as the active Owner' })
  @ApiParam({ name: 'householdId', format: 'uuid', type: String })
  @ApiBody({ type: CreateHouseholdInvitationRequestDto })
  @ApiCreatedResponse({
    description: 'The raw invitation token is returned by this response only once.',
    type: CreateHouseholdInvitationResponseDto,
    example: CREATE_HOUSEHOLD_INVITATION_RESPONSE_EXAMPLE,
  })
  @ApiBadRequestResponse({ type: HouseholdErrorDto, example: HOUSEHOLD_VALIDATION_ERROR_EXAMPLE })
  @ApiForbiddenResponse({ type: HouseholdErrorDto, example: HOUSEHOLD_FORBIDDEN_ERROR_EXAMPLE })
  @ApiNotFoundResponse({ type: HouseholdErrorDto, example: HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE })
  @ApiUnauthorizedResponse({
    type: AuthenticationErrorDto,
    example: AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  })
  @ZodSerializerDto(CreateHouseholdInvitationResponseDto)
  async create(
    @Req() request: Request,
    @Param('householdId') householdId: string,
    @Body() body: unknown,
  ): Promise<CreateHouseholdInvitationResponse> {
    const parsedHouseholdId = HouseholdIdSchema.safeParse(householdId);
    const parsedBody = CreateHouseholdInvitationRequestSchema.safeParse(body);

    if (!parsedHouseholdId.success) {
      throw new NotFoundException(HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE);
    }

    if (!parsedBody.success) {
      throw new BadRequestException(HOUSEHOLD_VALIDATION_ERROR_EXAMPLE);
    }

    const { user } = authenticatedUserContext(request);

    try {
      const created = await this.createInvitation.execute({
        householdId: parsedHouseholdId.data,
        internalUserId: user.id,
        targetEmail: parsedBody.data.targetEmail,
      });

      return CreateHouseholdInvitationResponseServerSchema.parse({
        invitation: invitationSummary(created),
        invitationToken: created.rawToken,
      });
    } catch (error: unknown) {
      throwPublicHouseholdError(error);
    }
  }

  @Get('households/:householdId/invitations')
  @ApiOperation({ summary: 'List invitation metadata as the active Owner' })
  @ApiParam({ name: 'householdId', format: 'uuid', type: String })
  @ApiOkResponse({
    type: ListHouseholdInvitationsResponseDto,
    example: LIST_HOUSEHOLD_INVITATIONS_RESPONSE_EXAMPLE,
  })
  @ApiForbiddenResponse({ type: HouseholdErrorDto, example: HOUSEHOLD_FORBIDDEN_ERROR_EXAMPLE })
  @ApiNotFoundResponse({ type: HouseholdErrorDto, example: HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE })
  @ApiUnauthorizedResponse({
    type: AuthenticationErrorDto,
    example: AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  })
  @ZodSerializerDto(ListHouseholdInvitationsResponseDto)
  async list(
    @Req() request: Request,
    @Param('householdId') householdId: string,
  ): Promise<ListHouseholdInvitationsResponse> {
    const id = HouseholdIdSchema.safeParse(householdId);

    if (!id.success) {
      throw new NotFoundException(HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE);
    }

    const { user } = authenticatedUserContext(request);

    try {
      const invitations = await this.listInvitations.execute({
        householdId: id.data,
        internalUserId: user.id,
      });

      return ListHouseholdInvitationsResponseServerSchema.parse({
        invitations: invitations.map(invitationSummary),
      });
    } catch (error: unknown) {
      throwPublicHouseholdError(error);
    }
  }

  @Post('households/:householdId/invitations/:invitationId/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke a pending invitation as the active Owner' })
  @ApiParam({ name: 'householdId', format: 'uuid', type: String })
  @ApiParam({ name: 'invitationId', format: 'uuid', type: String })
  @ApiOkResponse({ type: RevokeHouseholdInvitationResponseDto })
  @ApiConflictResponse({
    type: HouseholdErrorDto,
    example: HOUSEHOLD_INVITATION_UNAVAILABLE_ERROR_EXAMPLE,
  })
  @ApiForbiddenResponse({ type: HouseholdErrorDto, example: HOUSEHOLD_FORBIDDEN_ERROR_EXAMPLE })
  @ApiNotFoundResponse({
    type: HouseholdErrorDto,
    example: HOUSEHOLD_INVITATION_NOT_FOUND_ERROR_EXAMPLE,
  })
  @ApiUnauthorizedResponse({
    type: AuthenticationErrorDto,
    example: AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  })
  @ZodSerializerDto(RevokeHouseholdInvitationResponseDto)
  async revoke(
    @Req() request: Request,
    @Param('householdId') householdId: string,
    @Param('invitationId') invitationId: string,
  ): Promise<RevokeHouseholdInvitationResponse> {
    const household = HouseholdIdSchema.safeParse(householdId);
    const invitation = HouseholdInvitationIdSchema.safeParse(invitationId);

    if (!household.success) {
      throw new NotFoundException(HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE);
    }

    if (!invitation.success) {
      throw new NotFoundException(HOUSEHOLD_INVITATION_NOT_FOUND_ERROR_EXAMPLE);
    }

    const { user } = authenticatedUserContext(request);

    try {
      const revoked = await this.revokeInvitation.execute({
        householdId: household.data,
        internalUserId: user.id,
        invitationId: invitation.data,
      });

      return RevokeHouseholdInvitationResponseServerSchema.parse({
        invitation: invitationSummary(revoked),
      });
    } catch (error: unknown) {
      throwPublicHouseholdError(error);
    }
  }

  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Accept an invitation as the authenticated User' })
  @ApiBody({ type: AcceptHouseholdInvitationRequestDto })
  @ApiOkResponse({ type: AcceptHouseholdInvitationResponseDto })
  @ApiBadRequestResponse({ type: HouseholdErrorDto, example: HOUSEHOLD_VALIDATION_ERROR_EXAMPLE })
  @ApiConflictResponse({
    type: HouseholdErrorDto,
    example: HOUSEHOLD_INVITATION_UNAVAILABLE_ERROR_EXAMPLE,
  })
  @ApiUnauthorizedResponse({
    type: AuthenticationErrorDto,
    example: AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  })
  @ZodSerializerDto(AcceptHouseholdInvitationResponseDto)
  async accept(
    @Req() request: Request,
    @Body() body: unknown,
  ): Promise<AcceptHouseholdInvitationResponse> {
    const parsed = AcceptHouseholdInvitationRequestSchema.safeParse(body);

    if (!parsed.success) {
      throw new BadRequestException(HOUSEHOLD_VALIDATION_ERROR_EXAMPLE);
    }

    const { externalIdentity, user } = authenticatedUserContext(request);

    try {
      const accepted = await this.acceptInvitation.execute({
        authenticatedEmail: externalIdentity.email,
        authenticatedEmailVerified: externalIdentity.emailVerified,
        internalUserId: user.id,
        rawToken: parsed.data.invitationToken,
      });

      return AcceptHouseholdInvitationResponseServerSchema.parse({
        household: householdSummary(accepted.context),
      });
    } catch (error: unknown) {
      throwPublicHouseholdError(error);
    }
  }

  @Get('households/:householdId/members')
  @ApiOperation({ summary: 'List minimal active Household membership projections' })
  @ApiParam({ name: 'householdId', format: 'uuid', type: String })
  @ApiOkResponse({
    type: ListHouseholdMembersResponseDto,
    example: LIST_HOUSEHOLD_MEMBERS_RESPONSE_EXAMPLE,
  })
  @ApiNotFoundResponse({ type: HouseholdErrorDto, example: HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE })
  @ApiUnauthorizedResponse({
    type: AuthenticationErrorDto,
    example: AUTHENTICATION_REQUIRED_ERROR_EXAMPLE,
  })
  @ZodSerializerDto(ListHouseholdMembersResponseDto)
  async members(
    @Req() request: Request,
    @Param('householdId') householdId: string,
  ): Promise<ListHouseholdMembersResponse> {
    const id = HouseholdIdSchema.safeParse(householdId);

    if (!id.success) {
      throw new NotFoundException(HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE);
    }

    const { user } = authenticatedUserContext(request);

    try {
      const members = await this.listMembers.execute({
        householdId: id.data,
        internalUserId: user.id,
      });

      return ListHouseholdMembersResponseServerSchema.parse({
        members: members.map((membership) => ({
          isCurrentUser: membership.userId === user.id,
          role: membership.role,
        })),
      });
    } catch (error: unknown) {
      throwPublicHouseholdError(error);
    }
  }
}
