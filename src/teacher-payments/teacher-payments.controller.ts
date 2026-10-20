import {
  Controller, Get, Post, Patch, Param, Query, Body, Req, UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TeacherPaymentsService } from './teacher-payments.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { HasTeacherProfileGuard } from '../teachers/has-teacher-profile.guard.js';

@Controller('teacher-payments')
export class TeacherPaymentsController {
  constructor(private service: TeacherPaymentsService) {}

  // ---------- Teacher ----------

  @Get('me')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  getMySummary(@Req() req: any) {
    return this.service.getMySummary(req.user.userId);
  }

  @Post('request')
  @UseGuards(AuthGuard('jwt'), HasTeacherProfileGuard)
  requestPayment(@Req() req: any) {
    return this.service.requestPayment(req.user.userId);
  }

  // ---------- Admin ----------

  @Get()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  listAll(@Query('status') status?: string) {
    return this.service.listAllRequests(status);
  }

  @Patch(':id/approve')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.service.approve(id, req.user.userId);
  }

  @Patch(':id/mark-paid')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  markPaid(@Req() req: any, @Param('id') id: string) {
    return this.service.markPaid(id, req.user.userId);
  }

  @Patch(':id/reject')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: { note?: string }) {
    return this.service.reject(id, req.user.userId, body?.note);
  }
}