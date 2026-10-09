import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReferralsService } from './referrals.service.js';

@Controller('referrals')
@UseGuards(AuthGuard('jwt'))
export class ReferralsController {
  constructor(private referralsService: ReferralsService) {}

  @Get('my-link')
  getMyLink(@Req() req: any) {
    return this.referralsService.getMyLink(req.user.userId);
  }

  @Get('my-rewards')
  getMyRewards(@Req() req: any) {
    return this.referralsService.getMyRewards(req.user.userId);
  }
}