import { Module } from '@nestjs/common';
import { MinutesService } from './minutes.service.js';
import { MinutesController } from './minutes.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [MinutesController],
  providers: [MinutesService],
})
export class MinutesModule {}