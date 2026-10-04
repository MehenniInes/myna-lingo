import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    userId: string,
    data: {
      teacherId: string;
      serviceType: 'CONVERSATION_PARTNER' | 'PROFESSIONAL_TEACHER';
      scheduledAt: string;
      durationMin?: number;
      notes?: string;
    },
  ) {
    // ---------------------------------------------------------
    // 1. Validate student
    // ---------------------------------------------------------

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });

    if (!student) {
      throw new BadRequestException('User is not a student');
    }

    // ---------------------------------------------------------
    // 2. Validate teacher
    // ---------------------------------------------------------

    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { id: data.teacherId },
    });

    if (!teacher) {
      throw new NotFoundException('Teacher not found');
    }

    if (teacher.applicationStatus !== 'APPROVED') {
      throw new BadRequestException(
        'This teacher is not currently available for lessons',
      );
    }

    // ---------------------------------------------------------
    // 3. Validate duration
    // ---------------------------------------------------------

    const durationMin = Number(data.durationMin ?? 30);

    if (!Number.isInteger(durationMin) || durationMin <= 0) {
      throw new BadRequestException(
        'Duration must be a positive number of minutes',
      );
    }

    // For now we allow 15-minute increments.
    if (durationMin % 15 !== 0) {
      throw new BadRequestException(
        'Duration must be in 15-minute increments',
      );
    }

    // ---------------------------------------------------------
    // 4. Validate date
    // ---------------------------------------------------------

    const scheduled = new Date(data.scheduledAt);

    if (isNaN(scheduled.getTime())) {
      throw new BadRequestException('Invalid scheduled date');
    }

    if (scheduled <= new Date()) {
      throw new BadRequestException(
        'Scheduled time must be in the future',
      );
    }

    const lessonEnd = new Date(
      scheduled.getTime() + durationMin * 60 * 1000,
    );

    // ---------------------------------------------------------
    // 5. Check teacher availability
    // ---------------------------------------------------------

    this.validateTeacherAvailability(
      teacher.availability,
      scheduled,
      lessonEnd,
    );

    // ---------------------------------------------------------
    // 6. Check for overlapping bookings
    // ---------------------------------------------------------

    const overlappingBooking =
      await this.prisma.booking.findFirst({
        where: {
          teacherId: teacher.id,

          status: {
            in: ['PENDING', 'CONFIRMED'],
          },

          AND: [
            {
              scheduledAt: {
                lt: lessonEnd,
              },
            },
            {
              scheduledAt: {
                gte: new Date(
                  scheduled.getTime() -
                    24 * 60 * 60 * 1000,
                ),
              },
            },
          ],
        },
      });

    if (overlappingBooking) {
      const existingEnd = new Date(
        overlappingBooking.scheduledAt.getTime() +
          overlappingBooking.durationMin * 60 * 1000,
      );

      const overlaps =
        scheduled < existingEnd &&
        lessonEnd > overlappingBooking.scheduledAt;

      if (overlaps) {
        throw new BadRequestException(
          'This time overlaps with another booking',
        );
      }
    }

    // ---------------------------------------------------------
    // 7. Check teacher's hourly rate
    // ---------------------------------------------------------

    if (
      !teacher.requestedHourlyRateDA ||
      teacher.requestedHourlyRateDA <= 0
    ) {
      throw new BadRequestException(
        'This teacher has not set a valid hourly rate',
      );
    }

    // ---------------------------------------------------------
    // 8. Calculate required credits
    // ---------------------------------------------------------

    const requiredSeconds = durationMin * 60;

    // ---------------------------------------------------------
    // 9. Check current minute balance
    // ---------------------------------------------------------

    const latestLedgerEntry =
      await this.prisma.minuteLedgerEntry.findFirst({
        where: {
          studentId: student.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

    const currentBalance =
      latestLedgerEntry?.balanceAfter ?? 0;

    // ---------------------------------------------------------
    // 10. Check whether the student still has free session
    // ---------------------------------------------------------

    const freeTrialUsed =
      await this.prisma.minuteLedgerEntry.findFirst({
        where: {
          studentId: student.id,
          type: 'FREE_TRIAL',
        },
      });

    const canUseFreeTrial = !freeTrialUsed;

    if (currentBalance < requiredSeconds && !canUseFreeTrial) {
      throw new BadRequestException(
        `Not enough minutes. You need ${durationMin} minutes.`,
      );
    }

    // ---------------------------------------------------------
    // 11. Create PENDING booking + reserve credits
    // ---------------------------------------------------------

    const result = await this.prisma.$transaction(
      async (tx) => {
        /*
         * Re-check balance inside the transaction.
         *
         * This protects us from two booking requests being
         * created at almost exactly the same time.
         */

        const latest =
          await tx.minuteLedgerEntry.findFirst({
            where: {
              studentId: student.id,
            },
            orderBy: {
              createdAt: 'desc',
            },
          });

        const balance = latest?.balanceAfter ?? 0;

        const freeTrial =
          await tx.minuteLedgerEntry.findFirst({
            where: {
              studentId: student.id,
              type: 'FREE_TRIAL',
            },
          });

        const useFreeTrial =
          !freeTrial && balance < requiredSeconds;

        if (
          balance < requiredSeconds &&
          !useFreeTrial
        ) {
          throw new BadRequestException(
            'Not enough minutes',
          );
        }

        // Re-check overlap inside transaction.
        const existingBookings =
          await tx.booking.findMany({
            where: {
              teacherId: teacher.id,
              status: {
                in: ['PENDING', 'CONFIRMED'],
              },
              scheduledAt: {
                lt: lessonEnd,
              },
            },
          });

        const hasOverlap = existingBookings.some(
          (existing) => {
            const existingEnd = new Date(
              existing.scheduledAt.getTime() +
                existing.durationMin * 60 * 1000,
            );

            return (
              scheduled < existingEnd &&
              lessonEnd > existing.scheduledAt
            );
          },
        );

        if (hasOverlap) {
          throw new BadRequestException(
            'This time has just been booked by another student',
          );
        }

        // Create the booking as PENDING.
        const booking =
          await tx.booking.create({
            data: {
              studentId: student.id,
              teacherId: teacher.id,
              serviceType: data.serviceType,
              scheduledAt: scheduled,
              durationMin,
              status: 'PENDING',
              notes: data.notes?.trim() || null,
            },
          });

        // Reserve the student's minutes.
        const newBalance =
          useFreeTrial
            ? balance
            : balance - requiredSeconds;

        await tx.minuteLedgerEntry.create({
          data: {
            studentId: student.id,

            type: useFreeTrial
              ? 'FREE_TRIAL'
              : 'CALL_USAGE',

            seconds: -requiredSeconds,

            balanceAfter: newBalance,

            referenceId: booking.id,

            note: useFreeTrial
              ? `Free trial reserved for booking ${booking.id}`
              : `Minutes reserved for booking ${booking.id}`,
          },
        });

        return booking;
      },
      {
        isolationLevel: 'Serializable',
      },
    );

    // ---------------------------------------------------------
    // 12. Notify the STUDENT that request was received
    // ---------------------------------------------------------

    await this.notifications.create(
      userId,
      'BOOKING_CONFIRMED',
      'Booking request sent 📅',
      `Your lesson request for ${scheduled.toLocaleString()} is waiting for the teacher to accept.`,
      {
        bookingId: result.id,
        status: 'PENDING',
      },
    );

    // ---------------------------------------------------------
    // 13. Return booking
    // ---------------------------------------------------------

    return result;
  }

  // ===========================================================
  // TEACHER AVAILABILITY
  // ===========================================================

  private validateTeacherAvailability(
    availability: unknown,
    scheduled: Date,
    lessonEnd: Date,
  ) {
    if (!availability) {
      throw new BadRequestException(
        'This teacher has not configured their availability',
      );
    }

    if (!Array.isArray(availability)) {
      throw new BadRequestException(
        'Teacher availability is invalid',
      );
    }

    const dayName = scheduled.toLocaleDateString(
      'en-US',
      {
        weekday: 'long',
      },
    );

    const startTime = scheduled.toLocaleTimeString(
      'en-US',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      },
    );

    const endTime = lessonEnd.toLocaleTimeString(
      'en-US',
      {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      },
    );

    const matchingSlots = availability.filter(
      (slot: any) => {
        return (
          String(slot.day).toLowerCase() ===
          dayName.toLowerCase()
        );
      },
    );

    if (matchingSlots.length === 0) {
      throw new BadRequestException(
        `Teacher is not available on ${dayName}`,
      );
    }

    const fitsInsideAvailability =
      matchingSlots.some((slot: any) => {
        if (!slot.startTime || !slot.endTime) {
          return false;
        }

        return (
          this.timeToMinutes(startTime) >=
            this.timeToMinutes(slot.startTime) &&
          this.timeToMinutes(endTime) <=
            this.timeToMinutes(slot.endTime)
        );
      });

    if (!fitsInsideAvailability) {
      throw new BadRequestException(
        'The selected lesson time is outside the teacher availability',
      );
    }
  }

  private timeToMinutes(time: string): number {
    const [hours, minutes] = time
      .split(':')
      .map(Number);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes)
    ) {
      throw new BadRequestException(
        'Invalid availability time',
      );
    }

    return hours * 60 + minutes;
  }

  // ===========================================================
  // GET STUDENT BOOKINGS
  // ===========================================================

  async getMyBookings(userId: string) {
    const student =
      await this.prisma.studentProfile.findUnique({
        where: { userId },
      });

    if (!student) {
      return [];
    }

    return this.prisma.booking.findMany({
      where: {
        studentId: student.id,
      },

      include: {
        teacher: {
          include: {
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },

      orderBy: {
        scheduledAt: 'desc',
      },
    });
  }

  // ===========================================================
  // CANCEL BOOKING
  // ===========================================================

  async cancel(
    userId: string,
    bookingId: string,
  ) {
    const student =
      await this.prisma.studentProfile.findUnique({
        where: { userId },
      });

    if (!student) {
      throw new ForbiddenException();
    }

    const booking =
      await this.prisma.booking.findUnique({
        where: { id: bookingId },
      });

    if (!booking) {
      throw new NotFoundException(
        'Booking not found',
      );
    }

    if (booking.studentId !== student.id) {
      throw new ForbiddenException(
        'Not your booking',
      );
    }

    if (
      booking.status !== 'PENDING' &&
      booking.status !== 'CONFIRMED'
    ) {
      throw new BadRequestException(
        'Cannot cancel this booking',
      );
    }

    const requiredSeconds =
      booking.durationMin * 60;

    const result =
      await this.prisma.$transaction(
        async (tx) => {
          const latest =
            await tx.minuteLedgerEntry.findFirst({
              where: {
                studentId: student.id,
              },
              orderBy: {
                createdAt: 'desc',
              },
            });

          const currentBalance =
            latest?.balanceAfter ?? 0;

          const newBalance =
            currentBalance + requiredSeconds;

          await tx.minuteLedgerEntry.create({
            data: {
              studentId: student.id,
              type: 'REFUND',
              seconds: requiredSeconds,
              balanceAfter: newBalance,
              referenceId: booking.id,
              note: `Refund for cancelled booking ${booking.id}`,
            },
          });

          return tx.booking.update({
            where: {
              id: booking.id,
            },
            data: {
              status: 'CANCELLED',
            },
          });
        },
      );

    // Notify student.
    await this.notifications.create(
      userId,
      'BOOKING_CANCELLED',
      'Booking cancelled',
      `Your ${booking.durationMin}-minute lesson was cancelled and your minutes were refunded.`,
      {
        bookingId: booking.id,
      },
    );

    return result;
  }
  async accept(userId: string, bookingId: string) {
  const teacher = await this.prisma.teacherProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          fullName: true,
        },
      },
    },
  });

  if (!teacher) {
    throw new ForbiddenException('You are not a teacher');
  }

  const booking = await this.prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      student: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    throw new NotFoundException('Booking not found');
  }

  if (booking.teacherId !== teacher.id) {
    throw new ForbiddenException('This booking is not assigned to you');
  }

  if (booking.status !== 'PENDING') {
    throw new BadRequestException(
      `This booking is already ${booking.status.toLowerCase()}`,
    );
  }

  if (booking.scheduledAt <= new Date()) {
    throw new BadRequestException(
      'This booking can no longer be accepted because its time has passed',
    );
  }

  const lessonEnd = new Date(
    booking.scheduledAt.getTime() + booking.durationMin * 60 * 1000,
  );

  // Double-check that another confirmed lesson has not appeared
  // in this time slot.
  const conflictingBooking = await this.prisma.booking.findFirst({
    where: {
      id: { not: booking.id },
      teacherId: teacher.id,
      status: 'CONFIRMED',
      scheduledAt: {
        lt: lessonEnd,
      },
    },
  });

  if (conflictingBooking) {
    const conflictingEnd = new Date(
      conflictingBooking.scheduledAt.getTime() +
        conflictingBooking.durationMin * 60 * 1000,
    );

    const overlaps =
      booking.scheduledAt < conflictingEnd &&
      lessonEnd > conflictingBooking.scheduledAt;

    if (overlaps) {
      throw new BadRequestException(
        'This time slot is no longer available',
      );
    }
  }

  const updated = await this.prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: 'CONFIRMED',
    },
    include: {
      teacher: {
        include: {
          user: {
            select: {
              fullName: true,
            },
          },
        },
      },
      student: {
        include: {
          user: {
            select: {
              fullName: true,
            },
          },
        },
      },
    },
  });

  await this.notifications.create(
    booking.student.user.id,
    'BOOKING_CONFIRMED',
    'Booking accepted! 📅',
    `${teacher.user.fullName} accepted your lesson request for ${booking.scheduledAt.toLocaleString()}.`,
    {
      bookingId: booking.id,
    },
  );

  return updated;
}
async reject(userId: string, bookingId: string) {
  const teacher = await this.prisma.teacherProfile.findUnique({
    where: { userId },
  });

  if (!teacher) {
    throw new ForbiddenException('You are not a teacher');
  }

  const booking = await this.prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      student: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!booking) {
    throw new NotFoundException('Booking not found');
  }

  if (booking.teacherId !== teacher.id) {
    throw new ForbiddenException('This booking is not assigned to you');
  }

  if (booking.status !== 'PENDING') {
    throw new BadRequestException(
      `This booking is already ${booking.status.toLowerCase()}`,
    );
  }

  /*
   * The student's minutes were reserved when the booking
   * was created.
   *
   * Rejecting the booking therefore refunds them.
   */
  const lastLedger = await this.prisma.minuteLedgerEntry.findFirst({
    where: {
      studentId: booking.studentId,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  if (!lastLedger) {
    throw new BadRequestException(
      'Could not find the student minute balance',
    );
  }

  const refundSeconds = booking.durationMin * 60;

  const newBalance = lastLedger.balanceAfter + refundSeconds;

  const updated = await this.prisma.$transaction(async (tx) => {
    const cancelled = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: 'CANCELLED',
      },
    });

    await tx.minuteLedgerEntry.create({
      data: {
        studentId: booking.studentId,
        type: 'REFUND',
        seconds: refundSeconds,
        balanceAfter: newBalance,
        referenceId: booking.id,
        note: 'Booking rejected by teacher',
      },
    });

    return cancelled;
  });

  await this.notifications.create(
    booking.student.user.id,
    'BOOKING_CANCELLED',
    'Booking rejected',
    `Your lesson request for ${booking.scheduledAt.toLocaleString()} was rejected by the teacher. Your minutes have been refunded.`,
    {
      bookingId: booking.id,
    },
  );

  return updated;
}
  // ===========================================================
  // GET TEACHER BOOKINGS
  // ===========================================================

  async getTeacherBookings(
    userId: string,
    status?: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED',
  ) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!teacher) {
      throw new ForbiddenException('You are not a teacher');
    }

    return this.prisma.booking.findMany({
      where: {
        teacherId: teacher.id,
        ...(status ? { status } : {}),
      },

      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },

      orderBy: {
        scheduledAt: 'asc',
      },
    });
  }

  // ===========================================================
  // TEACHER MARKS BOOKING AS COMPLETED
  // ===========================================================

  async complete(userId: string, bookingId: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!teacher) {
      throw new ForbiddenException('You are not a teacher');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.teacherId !== teacher.id) {
      throw new ForbiddenException(
        'This booking is not assigned to you',
      );
    }

    if (booking.status !== 'CONFIRMED') {
      throw new BadRequestException(
        'Only confirmed bookings can be marked as completed',
      );
    }

    const updated = await this.prisma.booking.update({
      where: {
        id: booking.id,
      },
      data: {
        status: 'COMPLETED',
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
        teacher: {
          include: {
            user: {
              select: {
                fullName: true,
              },
            },
          },
        },
      },
    });

    await this.notifications.create(
      booking.student.user.id,
      'BOOKING_CONFIRMED',
      'Lesson completed',
      `Your lesson with your teacher has been marked as completed.`,
      {
        bookingId: booking.id,
        status: 'COMPLETED',
      },
    );

    return updated;
  }

  // ===========================================================
  // TEACHER CANCELS A BOOKING
  // ===========================================================

  async cancelByTeacher(
    userId: string,
    bookingId: string,
  ) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (!teacher) {
      throw new ForbiddenException('You are not a teacher');
    }

    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
              },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.teacherId !== teacher.id) {
      throw new ForbiddenException(
        'This booking is not assigned to you',
      );
    }

    if (
      booking.status !== 'PENDING' &&
      booking.status !== 'CONFIRMED'
    ) {
      throw new BadRequestException(
        'This booking cannot be cancelled',
      );
    }

    const refundSeconds = booking.durationMin * 60;

    const updated = await this.prisma.$transaction(
      async (tx) => {
        const latestLedger =
          await tx.minuteLedgerEntry.findFirst({
            where: {
              studentId: booking.studentId,
            },
            orderBy: {
              createdAt: 'desc',
            },
          });

        const currentBalance =
          latestLedger?.balanceAfter ?? 0;

        const newBalance =
          currentBalance + refundSeconds;

        const cancelled =
          await tx.booking.update({
            where: {
              id: booking.id,
            },
            data: {
              status: 'CANCELLED',
            },
          });

        await tx.minuteLedgerEntry.create({
          data: {
            studentId: booking.studentId,
            type: 'REFUND',
            seconds: refundSeconds,
            balanceAfter: newBalance,
            referenceId: booking.id,
            note: `Refund for teacher-cancelled booking ${booking.id}`,
          },
        });

        return cancelled;
      },
    );

    await this.notifications.create(
      booking.student.user.id,
      'BOOKING_CANCELLED',
      'Lesson cancelled',
      `Your lesson for ${booking.scheduledAt.toLocaleString()} was cancelled by the teacher. Your minutes have been refunded.`,
      {
        bookingId: booking.id,
        status: 'CANCELLED',
      },
    );

    return updated;
  }
}