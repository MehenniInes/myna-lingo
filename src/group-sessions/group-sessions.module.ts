import { Module } from '@nestjs/common';
import { GroupSessionsService } from './group-sessions.service.js';
import { GroupSessionsController } from './group-sessions.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [GroupSessionsController],
  providers: [GroupSessionsService],
})
export class GroupSessionsModule {}