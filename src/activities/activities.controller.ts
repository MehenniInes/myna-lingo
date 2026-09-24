import { Controller, Get, Post, Param, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ActivitiesService } from './activities.service.js';

@Controller('activities')
export class ActivitiesController {
  constructor(private activitiesService: ActivitiesService) {}

  @Get()
  findAll(@Query('type') type?: string) {
    return this.activitiesService.findAll(type);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.activitiesService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/complete')
  complete(@Param('id') id: string, @Req() req: any) {
    return this.activitiesService.complete(req.user.userId, id);
  }
}