import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { BookingsService } from './bookings.service.js';

@Controller('bookings')
@UseGuards(AuthGuard('jwt'))
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  // Student creates a booking
  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.bookingsService.create(req.user.userId, body);
  }

  // Student's bookings
  @Get('my')
  getMyBookings(@Req() req: any) {
    return this.bookingsService.getMyBookings(req.user.userId);
  }

  // Teacher accepts a booking
  @Patch(':id/accept')
  accept(@Param('id') id: string, @Req() req: any) {
    return this.bookingsService.accept(req.user.userId, id);
  }

  // Teacher rejects a booking
  @Patch(':id/reject')
  reject(@Param('id') id: string, @Req() req: any) {
    return this.bookingsService.reject(req.user.userId, id);
  }

  // Student cancels a booking
  @Delete(':id')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.bookingsService.cancel(req.user.userId, id);
  }
}