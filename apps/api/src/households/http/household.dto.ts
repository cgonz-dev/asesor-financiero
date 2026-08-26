import {
  AcceptHouseholdInvitationRequestSchema,
  AcceptHouseholdInvitationResponseServerSchema,
  CreateHouseholdInvitationRequestSchema,
  CreateHouseholdInvitationResponseServerSchema,
  CreateHouseholdRequestSchema,
  HouseholdDetailServerSchema,
  ListHouseholdInvitationsResponseServerSchema,
  ListHouseholdMembersResponseServerSchema,
  ListHouseholdsResponseServerSchema,
  PublicHouseholdErrorSchema,
  RevokeHouseholdInvitationResponseServerSchema,
} from '@copiloto/contracts';
import { createZodDto } from 'nestjs-zod';

export class CreateHouseholdRequestDto extends createZodDto(CreateHouseholdRequestSchema) {}
export class HouseholdDetailDto extends createZodDto(HouseholdDetailServerSchema) {}
export class ListHouseholdsResponseDto extends createZodDto(ListHouseholdsResponseServerSchema) {}
export class HouseholdErrorDto extends createZodDto(PublicHouseholdErrorSchema) {}
export class CreateHouseholdInvitationRequestDto extends createZodDto(
  CreateHouseholdInvitationRequestSchema,
) {}
export class CreateHouseholdInvitationResponseDto extends createZodDto(
  CreateHouseholdInvitationResponseServerSchema,
) {}
export class ListHouseholdInvitationsResponseDto extends createZodDto(
  ListHouseholdInvitationsResponseServerSchema,
) {}
export class RevokeHouseholdInvitationResponseDto extends createZodDto(
  RevokeHouseholdInvitationResponseServerSchema,
) {}
export class AcceptHouseholdInvitationRequestDto extends createZodDto(
  AcceptHouseholdInvitationRequestSchema,
) {}
export class AcceptHouseholdInvitationResponseDto extends createZodDto(
  AcceptHouseholdInvitationResponseServerSchema,
) {}
export class ListHouseholdMembersResponseDto extends createZodDto(
  ListHouseholdMembersResponseServerSchema,
) {}
