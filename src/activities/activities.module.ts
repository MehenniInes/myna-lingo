import { Module } from '@nestjs/common';
import { ActivitiesService } from './activities.service.js';
import { ActivitiesController } from './activities.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { XpModule } from '../xp/xp.module.js';

@Module({
  imports: [PrismaModule, XpModule],
  controllers: [ActivitiesController],
  providers: [ActivitiesService],
})
export class ActivitiesModule {}