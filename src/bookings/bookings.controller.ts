import { Controller, Get, Post, Delete, Param, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { BookingsService } from './bookings.service.js';

@Controller('bookings')
@UseGuards(AuthGuard('jwt'))
export class BookingsController {
  constructor(private bookingsService: BookingsService) {}

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.bookingsService.create(req.user.userId, body);
  }

  @Get('my')
  getMyBookings(@Req() req: any) {
    return this.bookingsService.getMyBookings(req.user.userId);
  }

  @Delete(':id')
  cancel(@Param('id') id: string, @Req() req: any) {
    return this.bookingsService.cancel(req.user.userId, id);
  }
}