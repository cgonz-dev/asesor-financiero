import { z } from 'zod';

export const HOUSEHOLD_NAME_MAX_LENGTH = 100;
export const INVITATION_TARGET_EMAIL_MAX_LENGTH = 320;
export const RAW_HOUSEHOLD_INVITATION_TOKEN_LENGTH = 43;

export const HouseholdIdSchema = z.string().uuid().describe('Opaque Household identifier.');

export const HouseholdNameSchema = z
  .string()
  .trim()
  .min(1, 'Household name must not be empty.')
  .max(HOUSEHOLD_NAME_MAX_LENGTH, 'Household name is too long.')
  .describe('Human-readable Household name.');

export const HouseholdRoleSchema = z.enum(['owner', 'member']);
export const ActiveHouseholdMembershipStatusSchema = z.literal('active');
export const HouseholdInvitationStatusSchema = z.enum([
  'pending',
  'expired',
  'revoked',
  'accepted',
]);
export const HouseholdInvitationIdSchema = z
  .string()
  .uuid()
  .describe('Opaque Household invitation identifier; it is not the invitation secret.');
export const HouseholdInvitationTokenSchema = z
  .string()
  .length(RAW_HOUSEHOLD_INVITATION_TOKEN_LENGTH)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invitation token must use base64url characters.')
  .describe('Single-use opaque invitation secret submitted only in a POST body.');
export const InvitationTargetEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(INVITATION_TARGET_EMAIL_MAX_LENGTH)
  .email()
  .describe('Normalized delivery restriction; it is not a User identifier.');

const createHouseholdRequestShape = {
  name: HouseholdNameSchema,
} satisfies z.ZodRawShape;

export const CreateHouseholdRequestSchema = z.object(createHouseholdRequestShape).strict();

const householdSummaryShape = {
  id: HouseholdIdSchema,
  membershipStatus: ActiveHouseholdMembershipStatusSchema,
  name: HouseholdNameSchema,
  role: HouseholdRoleSchema,
} satisfies z.ZodRawShape;

export const HouseholdSummarySchema = z.object(householdSummaryShape);
export const HouseholdSummaryServerSchema = HouseholdSummarySchema.strict();
export const HouseholdSummaryClientSchema = HouseholdSummarySchema.loose();

export const HouseholdDetailSchema = z.object(householdSummaryShape);
export const HouseholdDetailServerSchema = HouseholdDetailSchema.strict();
export const HouseholdDetailClientSchema = HouseholdDetailSchema.loose();

const listHouseholdsResponseShape = {
  households: z.array(HouseholdSummarySchema),
} satisfies z.ZodRawShape;

export const ListHouseholdsResponseSchema = z.object(listHouseholdsResponseShape);
export const ListHouseholdsResponseServerSchema = ListHouseholdsResponseSchema.strict();
export const ListHouseholdsResponseClientSchema = ListHouseholdsResponseSchema.loose();

export const HouseholdErrorCodeSchema = z.enum([
  'HOUSEHOLD_FORBIDDEN',
  'HOUSEHOLD_INVITATION_NOT_FOUND',
  'HOUSEHOLD_INVITATION_UNAVAILABLE',
  'HOUSEHOLD_NOT_FOUND',
  'HOUSEHOLD_VALIDATION_FAILED',
]);

export const PublicHouseholdErrorSchema = z
  .object({
    code: HouseholdErrorCodeSchema,
    message: z.string().min(1).describe('Safe, localizable public message.'),
  })
  .strict();

export type CreateHouseholdRequest = z.infer<typeof CreateHouseholdRequestSchema>;
export type HouseholdDetail = z.infer<typeof HouseholdDetailSchema>;
export type HouseholdErrorCode = z.infer<typeof HouseholdErrorCodeSchema>;
export type HouseholdSummary = z.infer<typeof HouseholdSummarySchema>;
export type ListHouseholdsResponse = z.infer<typeof ListHouseholdsResponseSchema>;
export type PublicHouseholdError = z.infer<typeof PublicHouseholdErrorSchema>;

const householdInvitationSummaryShape = {
  createdAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  id: HouseholdInvitationIdSchema,
  status: HouseholdInvitationStatusSchema,
  targetEmailHint: z
    .string()
    .min(3)
    .max(INVITATION_TARGET_EMAIL_MAX_LENGTH)
    .describe('Redacted delivery hint visible only to the authorized Owner.'),
} satisfies z.ZodRawShape;

export const HouseholdInvitationSummarySchema = z.object(householdInvitationSummaryShape);
export const HouseholdInvitationSummaryServerSchema = HouseholdInvitationSummarySchema.strict();
export const HouseholdInvitationSummaryClientSchema = HouseholdInvitationSummarySchema.loose();

export const CreateHouseholdInvitationRequestSchema = z
  .object({ targetEmail: InvitationTargetEmailSchema })
  .strict();
export const CreateHouseholdInvitationResponseSchema = z.object({
  invitation: HouseholdInvitationSummarySchema,
  invitationToken: HouseholdInvitationTokenSchema,
});
export const CreateHouseholdInvitationResponseServerSchema = z
  .object({
    invitation: HouseholdInvitationSummaryServerSchema,
    invitationToken: HouseholdInvitationTokenSchema,
  })
  .strict();
export const CreateHouseholdInvitationResponseClientSchema =
  CreateHouseholdInvitationResponseSchema.loose();

export const ListHouseholdInvitationsResponseSchema = z.object({
  invitations: z.array(HouseholdInvitationSummarySchema),
});
export const ListHouseholdInvitationsResponseServerSchema = z
  .object({ invitations: z.array(HouseholdInvitationSummaryServerSchema) })
  .strict();
export const ListHouseholdInvitationsResponseClientSchema =
  ListHouseholdInvitationsResponseSchema.loose();

export const RevokeHouseholdInvitationResponseSchema = z.object({
  invitation: HouseholdInvitationSummarySchema,
});
export const RevokeHouseholdInvitationResponseServerSchema = z
  .object({ invitation: HouseholdInvitationSummaryServerSchema })
  .strict();
export const RevokeHouseholdInvitationResponseClientSchema =
  RevokeHouseholdInvitationResponseSchema.loose();

export const AcceptHouseholdInvitationRequestSchema = z
  .object({ invitationToken: HouseholdInvitationTokenSchema })
  .strict();
export const AcceptHouseholdInvitationResponseSchema = z.object({
  household: HouseholdSummarySchema,
});
export const AcceptHouseholdInvitationResponseServerSchema = z
  .object({ household: HouseholdSummaryServerSchema })
  .strict();
export const AcceptHouseholdInvitationResponseClientSchema =
  AcceptHouseholdInvitationResponseSchema.loose();

export const HouseholdMemberSummarySchema = z.object({
  isCurrentUser: z.boolean(),
  role: HouseholdRoleSchema,
});
export const HouseholdMemberSummaryServerSchema = HouseholdMemberSummarySchema.strict();
export const HouseholdMemberSummaryClientSchema = HouseholdMemberSummarySchema.loose();
export const ListHouseholdMembersResponseSchema = z.object({
  members: z.array(HouseholdMemberSummarySchema),
});
export const ListHouseholdMembersResponseServerSchema = z
  .object({ members: z.array(HouseholdMemberSummaryServerSchema) })
  .strict();
export const ListHouseholdMembersResponseClientSchema = ListHouseholdMembersResponseSchema.loose();

export type AcceptHouseholdInvitationRequest = z.infer<
  typeof AcceptHouseholdInvitationRequestSchema
>;
export type AcceptHouseholdInvitationResponse = z.infer<
  typeof AcceptHouseholdInvitationResponseSchema
>;
export type CreateHouseholdInvitationRequest = z.infer<
  typeof CreateHouseholdInvitationRequestSchema
>;
export type CreateHouseholdInvitationResponse = z.infer<
  typeof CreateHouseholdInvitationResponseSchema
>;
export type HouseholdInvitationStatus = z.infer<typeof HouseholdInvitationStatusSchema>;
export type HouseholdInvitationSummary = z.infer<typeof HouseholdInvitationSummarySchema>;
export type HouseholdMemberSummary = z.infer<typeof HouseholdMemberSummarySchema>;
export type ListHouseholdInvitationsResponse = z.infer<
  typeof ListHouseholdInvitationsResponseSchema
>;
export type ListHouseholdMembersResponse = z.infer<typeof ListHouseholdMembersResponseSchema>;
export type RevokeHouseholdInvitationResponse = z.infer<
  typeof RevokeHouseholdInvitationResponseSchema
>;

export const HOUSEHOLD_SUMMARY_EXAMPLE = {
  id: '22222222-2222-4222-8222-222222222222',
  membershipStatus: 'active',
  name: 'Hogar de prueba',
  role: 'owner',
} as const satisfies HouseholdSummary;

export const LIST_HOUSEHOLDS_RESPONSE_EXAMPLE = {
  households: [HOUSEHOLD_SUMMARY_EXAMPLE],
} as const satisfies ListHouseholdsResponse;

export const HOUSEHOLD_NOT_FOUND_ERROR_EXAMPLE = {
  code: 'HOUSEHOLD_NOT_FOUND',
  message: 'El hogar no existe o no está disponible.',
} as const satisfies PublicHouseholdError;

export const HOUSEHOLD_VALIDATION_ERROR_EXAMPLE = {
  code: 'HOUSEHOLD_VALIDATION_FAILED',
  message: 'Revisa los datos del hogar.',
} as const satisfies PublicHouseholdError;

export const HOUSEHOLD_FORBIDDEN_ERROR_EXAMPLE = {
  code: 'HOUSEHOLD_FORBIDDEN',
  message: 'No tienes permiso para realizar esta acción en el hogar.',
} as const satisfies PublicHouseholdError;

export const HOUSEHOLD_INVITATION_NOT_FOUND_ERROR_EXAMPLE = {
  code: 'HOUSEHOLD_INVITATION_NOT_FOUND',
  message: 'La invitación no existe o no está disponible.',
} as const satisfies PublicHouseholdError;

export const HOUSEHOLD_INVITATION_UNAVAILABLE_ERROR_EXAMPLE = {
  code: 'HOUSEHOLD_INVITATION_UNAVAILABLE',
  message: 'La invitación no es válida o ya no está disponible.',
} as const satisfies PublicHouseholdError;

export const HOUSEHOLD_INVITATION_SUMMARY_EXAMPLE = {
  createdAt: '2026-08-25T18:00:00.000Z',
  expiresAt: '2026-09-01T18:00:00.000Z',
  id: '33333333-3333-4333-8333-333333333333',
  status: 'pending',
  targetEmailHint: 'p***@example.test',
} as const satisfies HouseholdInvitationSummary;

export const CREATE_HOUSEHOLD_INVITATION_RESPONSE_EXAMPLE = {
  invitation: HOUSEHOLD_INVITATION_SUMMARY_EXAMPLE,
  invitationToken: '0123456789abcdefghijklmnopqrstuvwxyz_-ABCDE',
} as const satisfies CreateHouseholdInvitationResponse;

export const LIST_HOUSEHOLD_INVITATIONS_RESPONSE_EXAMPLE = {
  invitations: [HOUSEHOLD_INVITATION_SUMMARY_EXAMPLE],
} as const satisfies ListHouseholdInvitationsResponse;

export const LIST_HOUSEHOLD_MEMBERS_RESPONSE_EXAMPLE = {
  members: [
    { isCurrentUser: true, role: 'owner' },
    { isCurrentUser: false, role: 'member' },
  ],
} as const satisfies ListHouseholdMembersResponse;
