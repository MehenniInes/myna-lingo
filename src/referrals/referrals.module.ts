import { Module } from '@nestjs/common';
import { ReferralsService } from './referrals.service.js';
import { ReferralsController } from './referrals.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ReferralsController],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}