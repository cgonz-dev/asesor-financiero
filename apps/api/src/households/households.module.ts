import { Module } from '@nestjs/common';

import { CreateHousehold } from './application/create-household';
import { HOUSEHOLD_REPOSITORY } from './application/household-repository';
import { ListUserHouseholds } from './application/list-user-households';
import { PrismaHouseholdRepository } from './infrastructure/prisma-household.repository';

@Module({
  providers: [
    PrismaHouseholdRepository,
    {
      provide: HOUSEHOLD_REPOSITORY,
      useExisting: PrismaHouseholdRepository,
    },
    CreateHousehold,
    ListUserHouseholds,
  ],
  exports: [CreateHousehold, ListUserHouseholds],
})
export class HouseholdsModule {}
