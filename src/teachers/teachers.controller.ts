import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TeachersService } from './teachers.service.js';
import { ApplyDto } from './dto/apply.dto.js';
import { ReviewDto } from './dto/review.dto.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Controller('teachers')
export class TeachersController {
  constructor(private teachersService: TeachersService) {}

  @Post('apply')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('TEACHER')
  async apply(@Req() req: any, @Body() dto: ApplyDto) {
    return this.teachersService.apply(req.user.userId, dto);
  }

  @Get('applications/pending')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  async listPending() {
    return this.teachersService.listPendingApplications();
  }

  @Patch('applications/:id/review')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  async review(@Req() req: any, @Param('id') id: string, @Body() dto: ReviewDto) {
    return this.teachersService.reviewApplication(id, req.user.userId, dto.decision, dto.note);
  }
}