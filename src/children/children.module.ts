import { Module } from '@nestjs/common';
import { ChildrenService } from './children.service.js';
import { ChildrenController } from './children.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ChildrenController],
  providers: [ChildrenService],
})
export class ChildrenModule {}