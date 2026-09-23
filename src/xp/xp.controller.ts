import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { XpService } from './xp.service.js';

@Controller('xp')
@UseGuards(AuthGuard('jwt'))
export class XpController {
  constructor(private xpService: XpService) {}

  @Get('balance')
  getBalance(@Req() req: any) {
    return this.xpService.getBalance(req.user.userId);
  }

  @Get('transactions')
  getTransactions(@Req() req: any) {
    return this.xpService.getTransactions(req.user.userId);
  }
}