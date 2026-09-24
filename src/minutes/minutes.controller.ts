import { Controller, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { MinutesService } from './minutes.service.js';

@Controller('minutes')
@UseGuards(AuthGuard('jwt'))
export class MinutesController {
  constructor(private minutesService: MinutesService) {}

  @Get('balance')
  getBalance(@Req() req: any) {
    return this.minutesService.getBalance(req.user.userId);
  }

  @Get('ledger')
  getLedger(@Req() req: any) {
    return this.minutesService.getLedger(req.user.userId);
  }
}