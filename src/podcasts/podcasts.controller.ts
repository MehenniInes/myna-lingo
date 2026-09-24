import { Controller, Get, Post, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PodcastsService } from './podcasts.service.js';

@Controller('podcasts')
export class PodcastsController {
  constructor(private podcastsService: PodcastsService) {}

  @Get()
  findAll() {
    return this.podcastsService.findAll();
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('my')
  getMyPodcasts(@Req() req: any) {
    return this.podcastsService.getMyPodcasts(req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.podcastsService.findOne(id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/purchase')
  purchase(@Param('id') id: string, @Req() req: any) {
    return this.podcastsService.purchase(req.user.userId, id);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post(':id/progress')
  saveProgress(
    @Param('id') id: string,
    @Body() body: { lastPositionSec: number },
    @Req() req: any,
  ) {
    return this.podcastsService.saveProgress(
      req.user.userId,
      id,
      body.lastPositionSec,
    );
  }
}