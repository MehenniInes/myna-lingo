import {
  Injectable, BadRequestException, NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class TeacherPaymentsService {
  constructor(private prisma: PrismaService) {}

  // Available = total earned LESSON_COMPLETED minus frozen in PENDING/APPROVED/PAID requests
  async getTeacherAvailableSeconds(teacherProfileId: string) {
    const earned = await this.prisma.teachingTimeLedger.aggregate({
      where: { teacherId: teacherProfileId, type: 'LESSON_COMPLETED' },
      _sum: { seconds: true },
    });
    const totalEarned = earned._sum.seconds ?? 0;

    const frozen = await this.prisma.teacherPaymentRequest.aggregate({
      where: {
        teacherId: teacherProfileId,
        status: { in: ['PENDING', 'APPROVED', 'PAID'] },
      },
      _sum: { frozenSeconds: true },
    });
    const totalFrozen = frozen._sum.frozenSeconds ?? 0;

    return Math.max(0, totalEarned - totalFrozen);
  }

  async getMySummary(userId: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      select: { id: true, internalHourlyRateDA: true },
    });
    if (!teacher) throw new NotFoundException('Teacher profile not found');

    const [availableSec, pendingAgg, approvedAgg, paidAgg, earnedAgg, requests] =
      await Promise.all([
        this.getTeacherAvailableSeconds(teacher.id),
        this.prisma.teacherPaymentRequest.aggregate({
          where: { teacherId: teacher.id, status: 'PENDING' },
          _sum: { frozenSeconds: true },
        }),
        this.prisma.teacherPaymentRequest.aggregate({
          where: { teacherId: teacher.id, status: 'APPROVED' },
          _sum: { frozenSeconds: true },
        }),
        this.prisma.teacherPaymentRequest.aggregate({
          where: { teacherId: teacher.id, status: 'PAID' },
          _sum: { frozenSeconds: true, payoutDA: true },
        }),
        this.prisma.teachingTimeLedger.aggregate({
          where: { teacherId: teacher.id, type: 'LESSON_COMPLETED' },
          _sum: { seconds: true },
        }),
        this.prisma.teacherPaymentRequest.findMany({
          where: { teacherId: teacher.id },
          orderBy: { requestedAt: 'desc' },
          take: 50,
        }),
      ]);

    const rate = teacher.internalHourlyRateDA ?? 0;
    const estimatedPayoutDA = Math.floor((availableSec / 3600) * rate);

    return {
      availableSeconds: availableSec,
      pendingSeconds: pendingAgg._sum.frozenSeconds ?? 0,
      approvedSeconds: approvedAgg._sum.frozenSeconds ?? 0,
      paidSeconds: paidAgg._sum.frozenSeconds ?? 0,
      totalEarnedSeconds: earnedAgg._sum.seconds ?? 0,
      totalPaidDA: paidAgg._sum.payoutDA ?? 0,
      internalHourlyRateDA: rate,
      estimatedPayoutDA,
      requests,
    };
  }

  async requestPayment(userId: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!teacher) throw new NotFoundException('Teacher profile not found');

    const existing = await this.prisma.teacherPaymentRequest.findFirst({
      where: {
        teacherId: teacher.id,
        status: { in: ['PENDING', 'APPROVED'] },
      },
    });
    if (existing) {
      throw new BadRequestException(
        'You already have an active payment request. Wait for it to be paid or cancelled.',
      );
    }

    const availableSeconds = await this.getTeacherAvailableSeconds(teacher.id);
    if (availableSeconds < 60) {
      throw new BadRequestException(
        'You need at least 1 minute of unfrozen teaching time',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const request = await tx.teacherPaymentRequest.create({
        data: {
          teacherId: teacher.id,
          frozenSeconds: availableSeconds,
          status: 'PENDING',
        },
      });

      await tx.teachingTimeLedger.create({
        data: {
          teacherId: teacher.id,
          type: 'TIME_FROZEN',
          seconds: -availableSeconds,
          balanceAfter: 0,
          referenceId: request.id,
          note: `Frozen for payment request ${request.id}`,
        },
      });

      return request;
    });
  }

  // ---------- Admin ----------

  async listAllRequests(status?: string) {
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;

    return this.prisma.teacherPaymentRequest.findMany({
      where,
      include: {
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            internalHourlyRateDA: true,
            user: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: 500,
    });
  }

  async approve(requestId: string, adminUserId: string) {
    const req = await this.prisma.teacherPaymentRequest.findUnique({
      where: { id: requestId },
      include: { teacher: { select: { internalHourlyRateDA: true } } },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING requests can be approved');
    }

    const rate = req.teacher.internalHourlyRateDA ?? 0;
    const payoutDA = Math.floor((req.frozenSeconds / 3600) * rate);

    return this.prisma.teacherPaymentRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: adminUserId,
        payoutDA,
      },
    });
  }

  async markPaid(requestId: string, adminUserId: string) {
    const req = await this.prisma.teacherPaymentRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'APPROVED') {
      throw new BadRequestException('Only APPROVED requests can be marked as paid');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.teacherPaymentRequest.update({
        where: { id: requestId },
        data: {
          status: 'PAID',
          paidAt: new Date(),
          paidBy: adminUserId,
        },
      });

      await tx.teachingTimeLedger.create({
        data: {
          teacherId: req.teacherId,
          type: 'PAYMENT_COMPLETED',
          seconds: -req.frozenSeconds,
          balanceAfter: 0,
          referenceId: requestId,
          note: `Payout of ${req.payoutDA ?? 0} DA recorded`,
        },
      });

      return updated;
    });
  }

  async reject(requestId: string, adminUserId: string, note?: string) {
    const req = await this.prisma.teacherPaymentRequest.findUnique({
      where: { id: requestId },
    });
    if (!req) throw new NotFoundException('Request not found');
    if (req.status !== 'PENDING') {
      throw new BadRequestException('Only PENDING requests can be rejected');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.teachingTimeLedger.create({
        data: {
          teacherId: req.teacherId,
          type: 'ADMIN_ADJUSTMENT',
          seconds: req.frozenSeconds,
          balanceAfter: 0,
          referenceId: requestId,
          note: `Request rejected — time unfrozen`,
        },
      });

      return tx.teacherPaymentRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          note: note ?? null,
        },
      });
    });
  }
}