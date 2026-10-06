import { Controller, Get, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AgoraTokenService } from './agora-token.service.js';

@Controller('agora')
@UseGuards(AuthGuard('jwt'))
export class AgoraController {
  constructor(private readonly agoraTokenService: AgoraTokenService) {}

    @Get('token')
  getToken(
    @Query('channel') channel: string,
    @Query('uid') uid: string,
    @Req() req: any,
  ) {
    if (!channel) {
      return { error: 'channel is required' };
    }

    // Agora UID must be a 32-bit unsigned integer in [0, 65535]
    let userUid: number;
    if (uid) {
      const parsed = Number(uid);
      userUid = parsed >= 0 && parsed <= 65535
        ? parsed
        : Math.floor(Math.random() * 60000) + 1;
    } else {
      userUid = Math.floor(Math.random() * 60000) + 1;
    }

    return {
      token: this.agoraTokenService.generateRtcToken(channel, userUid),
      uid: userUid,
      channel,
    };
  }
}