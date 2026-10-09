import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ReferralsModule } from '../referrals/referrals.module.js';

@Module({
  imports: [PrismaModule, ReferralsModule],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}