import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CallsService } from './calls.service.js';

@Controller('calls')
@UseGuards(AuthGuard('jwt'))
export class CallsController {
  constructor(private callsService: CallsService) {}

  @Post('start')
  startCall(
    @Body() body: { teacherId: string; serviceType: 'CONVERSATION_PARTNER' | 'PROFESSIONAL_TEACHER' },
    @Req() req: any,
  ) {
    return this.callsService.startCall(req.user.userId, body.teacherId, body.serviceType);
  }

  @Post(':id/end')
  endCall(@Param('id') id: string, @Req() req: any) {
    return this.callsService.endCall(req.user.userId, id);
  }

  @Get('active')
  getActiveCall(@Req() req: any) {
    return this.callsService.getActiveCall(req.user.userId);
  }

  @Get('my')
  getMyCalls(@Req() req: any) {
    return this.callsService.getMyCalls(req.user.userId);
  }
    @Get(':id/teacher-token')
  getTeacherToken(@Req() req: any, @Param('id') id: string) {
    return this.callsService.getCallForTeacher(req.user.userId, id);
  }
}