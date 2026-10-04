import { Injectable, InternalServerErrorException } from '@nestjs/common';
// 1. Import the whole package as a default object
import AgoraToken from 'agora-token';

// 2. Destructure the needed parts from it
const { RtcTokenBuilder, RtcRole } = AgoraToken;

@Injectable()
export class AgoraTokenService {
  generateRtcToken(channelName: string, uid: number): string {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;

    if (!appId || !appCertificate) {
      throw new InternalServerErrorException(
        'Agora credentials (AGORA_APP_ID, AGORA_APP_CERTIFICATE) are missing',
      );
    }

    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    return RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      role,
      privilegeExpiredTs,
      privilegeExpiredTs,
    );
  }
}