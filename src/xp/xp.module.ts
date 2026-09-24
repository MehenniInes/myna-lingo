import { Module } from '@nestjs/common';
import { XpService } from './xp.service.js';
import { XpController } from './xp.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [XpController],
  providers: [XpService],
  exports: [XpService],
})
export class XpModule {}