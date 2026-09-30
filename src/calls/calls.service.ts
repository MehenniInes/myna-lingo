import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class CallsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async startCall(userId: string, teacherId: string, serviceType: 'CONVERSATION_PARTNER' | 'PROFESSIONAL_TEACHER') {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new BadRequestException('User is not a student');

    // Check teacher exists and is online
    const teacher = await this.prisma.teacherProfile.findUnique({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Teacher not found');
    if (!teacher.isOnline) throw new BadRequestException('Teacher is offline');

    // Check no active call already
    const activeCall = await this.prisma.call.findFirst({
      where: { studentId: student.id, status: 'ACTIVE' },
    });
    if (activeCall) throw new BadRequestException('You already have an active call');

    // Check balance
    const lastEntry = await this.prisma.minuteLedgerEntry.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });
    const balance = lastEntry?.balanceAfter ?? 0;
    if (balance < 60) throw new BadRequestException('Insufficient minutes (need at least 1 minute)');

    // Create call
    return this.prisma.call.create({
      data: {
        studentId: student.id,
        teacherId,
        serviceType,
        status: 'ACTIVE',
      },
    });
  }

  async endCall(userId: string, callId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.status !== 'ACTIVE') throw new BadRequestException('Call is not active');

    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student || student.id !== call.studentId) {
      throw new ForbiddenException('This is not your call');
    }

    const endTime = new Date();
    const durationSec = Math.max(0, Math.floor((endTime.getTime() - call.startTime.getTime()) / 1000));

    return this.prisma.$transaction(async (tx) => {
      // 1. Get current student balance
      const lastStudentEntry = await tx.minuteLedgerEntry.findFirst({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
      });
      const currentStudentBalance = lastStudentEntry?.balanceAfter ?? 0;
      const newStudentBalance = Math.max(0, currentStudentBalance - durationSec);

      // 2. Deduct from student
      await tx.minuteLedgerEntry.create({
        data: {
          studentId: student.id,
          type: 'CALL_USAGE',
          seconds: -durationSec,
          balanceAfter: newStudentBalance,
          referenceId: callId,
          note: `Call: ${Math.floor(durationSec / 60)}m ${durationSec % 60}s`,
        },
      });

      // 3. Add teaching time to teacher
      const lastTeacherEntry = await tx.teachingTimeLedger.findFirst({
        where: { teacherId: call.teacherId },
        orderBy: { createdAt: 'desc' },
      });
      const currentTeacherBalance = lastTeacherEntry?.balanceAfter ?? 0;

      await tx.teachingTimeLedger.create({
        data: {
          teacherId: call.teacherId,
          type: 'LESSON_COMPLETED',
          seconds: durationSec,
          balanceAfter: currentTeacherBalance + durationSec,
          referenceId: callId,
          note: `Lesson completed`,
        },
      });

      // 4. Update call record
      const updated = await tx.call.update({
        where: { id: callId },
        data: { endTime, durationSec, status: 'COMPLETED' },
      });

      return {
        callId,
        durationSec,
        studentBalanceAfter: newStudentBalance,
        teacherEarnedSec: durationSec,
        call: updated,
      };
    });
  }

  async getActiveCall(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) return null;
    return this.prisma.call.findFirst({
      where: { studentId: student.id, status: 'ACTIVE' },
      include: { teacher: { include: { user: { select: { fullName: true } } } } },
    });
  }

  async getMyCalls(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) return [];
    return this.prisma.call.findMany({
      where: { studentId: student.id },
      include: { teacher: { include: { user: { select: { fullName: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}