import { Module } from '@nestjs/common';

import { AcceptHouseholdInvitation } from './application/accept-household-invitation';
import { CreateHouseholdInvitation } from './application/create-household-invitation';
import { CreateHousehold } from './application/create-household';
import { GetHousehold } from './application/get-household';
import { HouseholdAuthorizationPolicy } from './application/household-authorization.policy';
import { HouseholdContextResolver } from './application/household-context-resolver';
import {
  HOUSEHOLD_INVITATION_CLOCK,
  SYSTEM_HOUSEHOLD_INVITATION_CLOCK,
} from './application/household-invitation-clock';
import {
  HOUSEHOLD_INVITATION_CONFIGURATION,
  householdInvitationConfigurationFromEnvironment,
} from './application/household-invitation-configuration';
import { HOUSEHOLD_INVITATION_REPOSITORY } from './application/household-invitation-repository';
import {
  HOUSEHOLD_INVITATION_TOKEN_SERVICE,
  NodeHouseholdInvitationTokenService,
} from './application/household-invitation-token';
import { HOUSEHOLD_REPOSITORY } from './application/household-repository';
import { ListHouseholdInvitations } from './application/list-household-invitations';
import { ListHouseholdMembers } from './application/list-household-members';
import { ListUserHouseholds } from './application/list-user-households';
import { RevokeHouseholdInvitation } from './application/revoke-household-invitation';
import { HouseholdInvitationsController } from './http/household-invitations.controller';
import { PrismaHouseholdInvitationRepository } from './infrastructure/prisma-household-invitation.repository';
import { PrismaHouseholdRepository } from './infrastructure/prisma-household.repository';
import { HouseholdsController } from './http/households.controller';

@Module({
  controllers: [HouseholdInvitationsController, HouseholdsController],
  providers: [
    PrismaHouseholdRepository,
    PrismaHouseholdInvitationRepository,
    {
      provide: HOUSEHOLD_INVITATION_REPOSITORY,
      useExisting: PrismaHouseholdInvitationRepository,
    },
    {
      provide: HOUSEHOLD_INVITATION_TOKEN_SERVICE,
      useValue: new NodeHouseholdInvitationTokenService(),
    },
    {
      provide: HOUSEHOLD_INVITATION_CLOCK,
      useValue: SYSTEM_HOUSEHOLD_INVITATION_CLOCK,
    },
    {
      provide: HOUSEHOLD_INVITATION_CONFIGURATION,
      useFactory: householdInvitationConfigurationFromEnvironment,
    },
    {
      provide: HOUSEHOLD_REPOSITORY,
      useExisting: PrismaHouseholdRepository,
    },
    CreateHousehold,
    HouseholdAuthorizationPolicy,
    HouseholdContextResolver,
    GetHousehold,
    AcceptHouseholdInvitation,
    CreateHouseholdInvitation,
    ListHouseholdInvitations,
    ListHouseholdMembers,
    ListUserHouseholds,
    RevokeHouseholdInvitation,
  ],
  exports: [CreateHousehold, GetHousehold, ListUserHouseholds],
})
export class HouseholdsModule {}
