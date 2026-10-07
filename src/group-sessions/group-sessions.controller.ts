import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GroupSessionsService } from './group-sessions.service.js';

@Controller('group-sessions')
@UseGuards(AuthGuard('jwt'))
export class GroupSessionsController {
  constructor(private groupSessionsService: GroupSessionsService) {}

  @Post('start/:groupClassId')
  startSession(@Param('groupClassId') groupClassId: string, @Req() req: any) {
    return this.groupSessionsService.startSession(req.user.userId, groupClassId);
  }

 @Get('active')
getMyActiveSession(@Req() req: any) {
  return this.groupSessionsService.getMyActiveSession(req.user.userId);
}

  @Get(':id')
  getSession(@Param('id') id: string) {
    return this.groupSessionsService.getSession(id);
  }

  @Post(':id/join')
  join(@Param('id') id: string, @Req() req: any) {
    return this.groupSessionsService.join(req.user.userId, id);
  }

  @Post(':id/leave')
  leave(@Param('id') id: string, @Req() req: any) {
    return this.groupSessionsService.leave(req.user.userId, id);
  }

  @Post(':id/heartbeat')
  heartbeat(@Param('id') id: string, @Req() req: any) {
    return this.groupSessionsService.heartbeat(req.user.userId, id);
  }

  @Post(':id/reconnect')
  reconnect(@Param('id') id: string, @Req() req: any) {
    return this.groupSessionsService.reconnect(req.user.userId, id);
  }

  @Post(':id/end')
  endSession(@Param('id') id: string, @Req() req: any) {
    return this.groupSessionsService.endSession(req.user.userId, id);
  }
}