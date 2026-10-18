import { Module } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatController } from './chat.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}