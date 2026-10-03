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
  Query,
} from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

import { BookingsService } from './bookings.service.js';

@Controller('bookings')
@UseGuards(AuthGuard('jwt'))
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
  ) {}

  // ===========================================================
  // STUDENT CREATES BOOKING
  // ===========================================================

  @Post()
  create(
    @Body() body: any,
    @Req() req: any,
  ) {
    return this.bookingsService.create(
      req.user.userId,
      body,
    );
  }

  // ===========================================================
  // STUDENT BOOKINGS
  // ===========================================================

  @Get('my')
  getMyBookings(@Req() req: any) {
    return this.bookingsService.getMyBookings(
      req.user.userId,
    );
  }

  // ===========================================================
  // TEACHER BOOKINGS
  // ===========================================================

  @Get('teacher')
  getTeacherBookings(
    @Req() req: any,
    @Query('status') status?: string,
  ) {
    const validStatuses = [
      'PENDING',
      'CONFIRMED',
      'COMPLETED',
      'CANCELLED',
    ] as const;

    if (
      status &&
      !validStatuses.includes(
        status as (typeof validStatuses)[number],
      )
    ) {
      throw new Error('Invalid booking status');
    }

    return this.bookingsService.getTeacherBookings(
      req.user.userId,
      status as
        | 'PENDING'
        | 'CONFIRMED'
        | 'COMPLETED'
        | 'CANCELLED'
        | undefined,
    );
  }

  // ===========================================================
  // TEACHER ACCEPTS BOOKING
  // ===========================================================

  @Patch(':id/accept')
  accept(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.bookingsService.accept(
      req.user.userId,
      id,
    );
  }

  // ===========================================================
  // TEACHER REJECTS BOOKING
  // ===========================================================

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.bookingsService.reject(
      req.user.userId,
      id,
    );
  }

  // ===========================================================
  // TEACHER MARKS BOOKING COMPLETED
  // ===========================================================

  @Patch(':id/complete')
  complete(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.bookingsService.complete(
      req.user.userId,
      id,
    );
  }

  // ===========================================================
  // TEACHER CANCELS BOOKING
  // ===========================================================

  @Patch(':id/cancel')
  cancelByTeacher(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.bookingsService.cancelByTeacher(
      req.user.userId,
      id,
    );
  }

  // ===========================================================
  // STUDENT CANCELS BOOKING
  // ===========================================================

  @Delete(':id')
  cancel(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.bookingsService.cancel(
      req.user.userId,
      id,
    );
  }
}