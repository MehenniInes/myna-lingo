import { Controller, Get, Post, Param, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GroupClassesService } from './group-classes.service.js';

@Controller('group-classes')
export class GroupClassesController {
  constructor(private groupClassesService: GroupClassesService) {}

  @Get()
  findAll() {
    return this.groupClassesService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my')
  getMyClasses(@Req() req: any) {
    return this.groupClassesService.getMyClasses(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groupClassesService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/join')
  join(@Param('id') id: string, @Req() req: any) {
    return this.groupClassesService.join(req.user.userId, id);
  }
}