import { Module } from '@nestjs/common';
import { TeacherPaymentsController } from './teacher-payments.controller.js';
import { TeacherPaymentsService } from './teacher-payments.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [TeacherPaymentsController],
  providers: [TeacherPaymentsService],
  exports: [TeacherPaymentsService],
})
export class TeacherPaymentsModule {}