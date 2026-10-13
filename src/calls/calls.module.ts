import { Module } from '@nestjs/common';
import { CallsService } from './calls.service.js';
import { CallsController } from './calls.controller.js';
import { CallsGateway } from './calls.gateway.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [CallsController],
  providers: [CallsService, CallsGateway],
  exports: [CallsService],
})
export class CallsModule {}