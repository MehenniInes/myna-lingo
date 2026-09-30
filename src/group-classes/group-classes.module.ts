import { Module } from '@nestjs/common';
import { GroupClassesService } from './group-classes.service.js';
import { GroupClassesController } from './group-classes.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [GroupClassesController],
  providers: [GroupClassesService],
})
export class GroupClassesModule {}