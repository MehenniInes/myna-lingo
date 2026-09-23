import { Module } from '@nestjs/common';
import { PackagesService } from './packages.service.js';
import { PackagesController } from './packages.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [PackagesController],
  providers: [PackagesService],
})
export class PackagesModule {}