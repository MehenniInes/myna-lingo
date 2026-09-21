import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TeachersService } from './teachers.service.js';
import { ApplyDto } from './dto/apply.dto.js';
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
}