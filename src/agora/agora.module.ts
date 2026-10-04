import { Module } from '@nestjs/common';
import { AgoraTokenService } from './agora-token.service.js';
import { AgoraController } from './agora.controller.js';

@Module({
  controllers: [AgoraController],
  providers: [AgoraTokenService],
})
export class AgoraModule {}