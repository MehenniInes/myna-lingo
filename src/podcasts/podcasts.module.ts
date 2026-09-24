import { Module } from '@nestjs/common';
import { PodcastsService } from './podcasts.service.js';
import { PodcastsController } from './podcasts.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PodcastsController],
  providers: [PodcastsService],
})
export class PodcastsModule {}