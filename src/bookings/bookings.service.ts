import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async create(userId: string, data: {
    teacherId: string;
    serviceType: 'CONVERSATION_PARTNER' | 'PROFESSIONAL_TEACHER';
    scheduledAt: string;
    durationMin?: number;
    notes?: string;
  }) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new BadRequestException('User is not a student');

    const teacher = await this.prisma.teacherProfile.findUnique({ where: { id: data.teacherId } });
    if (!teacher) throw new NotFoundException('Teacher not found');

    const scheduled = new Date(data.scheduledAt);
    if (isNaN(scheduled.getTime())) throw new BadRequestException('Invalid date');
    if (scheduled < new Date()) throw new BadRequestException('Scheduled time must be in the future');

    const booking = await this.prisma.booking.create({
      data: {
        studentId: student.id,
        teacherId: data.teacherId,
        serviceType: data.serviceType,
        scheduledAt: scheduled,
        durationMin: data.durationMin ?? 30,
        notes: data.notes,
      },
    });

    await this.notifications.create(
      userId,
      'BOOKING_CONFIRMED',
      'Booking Confirmed! 📅',
      `Your lesson is scheduled for ${scheduled.toLocaleString()}.`,
      { bookingId: booking.id },
    );

    return booking;
  }

  async getMyBookings(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) return [];
    return this.prisma.booking.findMany({
      where: { studentId: student.id },
      include: {
        teacher: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: { scheduledAt: 'desc' },
    });
  }

  async cancel(userId: string, bookingId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new ForbiddenException();

    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.studentId !== student.id) throw new ForbiddenException('Not your booking');
    if (booking.status !== 'PENDING' && booking.status !== 'CONFIRMED') {
      throw new BadRequestException('Cannot cancel this booking');
    }

    return this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    });
  }
}