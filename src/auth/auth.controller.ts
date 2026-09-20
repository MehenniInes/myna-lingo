import { Body, Controller, Post, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service.js';
import { CreateUserDto } from '../users/dto/create-user.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: CreateUserDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('admin-only-test')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  adminOnlyTest() {
    return { message: 'You are an admin and this worked.' };
  }
}