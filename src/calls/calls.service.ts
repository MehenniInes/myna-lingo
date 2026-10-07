import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import agoraToken from 'agora-token';
const { RtcTokenBuilder, RtcRole } = agoraToken;

@Injectable()
export class CallsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ---------- Agora helpers ----------

  private buildChannelName(studentId: string, teacherId: string) {
    return `myna-${studentId.slice(0, 8)}-${teacherId.slice(0, 8)}-${Date.now()}`;
  }

  private buildAgoraToken(channelName: string, uid: number) {
    const appId = process.env.AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    if (!appId || !appCertificate) {
      throw new BadRequestException('Agora credentials are not configured');
    }

    const expirationInSeconds = 3600; // 1 hour
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTimestamp + expirationInSeconds;

    return RtcTokenBuilder.buildTokenWithUid(
      appId,
      appCertificate,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpireTime,
      privilegeExpireTime,
    );
  }

  private async getStudentBalanceSeconds(studentId: string) {
    const lastEntry = await this.prisma.minuteLedgerEntry.findFirst({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
    return lastEntry?.balanceAfter ?? 0;
  }

  // ---------- Public API ----------

  async startCall(
    userId: string,
    teacherId: string,
    serviceType: 'CONVERSATION_PARTNER' | 'PROFESSIONAL_TEACHER',
  ) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new BadRequestException('User is not a student');

    const teacher = await this.prisma.teacherProfile.findUnique({ where: { id: teacherId } });
    if (!teacher) throw new NotFoundException('Teacher not found');
    if (!teacher.isOnline) throw new BadRequestException('Teacher is offline');
    if (teacher.applicationStatus !== 'APPROVED') {
      throw new BadRequestException('Teacher is not available for calls');
    }

    const activeCall = await this.prisma.call.findFirst({
      where: { studentId: student.id, status: 'ACTIVE' },
    });
    if (activeCall) throw new BadRequestException('You already have an active call');

    const balanceSeconds = await this.getStudentBalanceSeconds(student.id);
    if (balanceSeconds < 60) {
      throw new BadRequestException('Insufficient minutes (need at least 1 minute)');
    }

    const channelName = this.buildChannelName(student.id, teacherId);
    const studentUid = 1;
    const teacherUid = 2;

    const call = await this.prisma.call.create({
      data: {
        studentId: student.id,
        teacherId,
        serviceType,
        agoraChannelId: channelName,
        status: 'ACTIVE',
      },
    });

    return {
      callId: call.id,
      channelName,
      appId: process.env.AGORA_APP_ID,
      studentUid,
      teacherUid,
      studentToken: this.buildAgoraToken(channelName, studentUid),
      teacherToken: this.buildAgoraToken(channelName, teacherUid),
      startTime: call.startTime,
      balanceSeconds,
    };
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
    const rawDurationSec = Math.max(
      0,
      Math.floor((endTime.getTime() - call.startTime.getTime()) / 1000),
    );

    return this.prisma.$transaction(async (tx) => {
      const lastStudentEntry = await tx.minuteLedgerEntry.findFirst({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
      });
      const currentStudentBalance = lastStudentEntry?.balanceAfter ?? 0;

      // Clamp — no overage allowed. If the call ran longer than the balance,
      // we only bill what the student actually had.
      const billedSec = Math.min(rawDurationSec, currentStudentBalance);
      const newStudentBalance = currentStudentBalance - billedSec;

      await tx.minuteLedgerEntry.create({
        data: {
          studentId: student.id,
          type: 'CALL_USAGE',
          seconds: -billedSec,
          balanceAfter: newStudentBalance,
          referenceId: callId,
          note: `Call: ${Math.floor(billedSec / 60)}m ${billedSec % 60}s`,
        },
      });

      const lastTeacherEntry = await tx.teachingTimeLedger.findFirst({
        where: { teacherId: call.teacherId },
        orderBy: { createdAt: 'desc' },
      });
      const currentTeacherBalance = lastTeacherEntry?.balanceAfter ?? 0;

      await tx.teachingTimeLedger.create({
        data: {
          teacherId: call.teacherId,
          type: 'LESSON_COMPLETED',
          seconds: billedSec,
          balanceAfter: currentTeacherBalance + billedSec,
          referenceId: callId,
          note: `Lesson completed`,
        },
      });

      const updated = await tx.call.update({
        where: { id: callId },
        data: { endTime, durationSec: billedSec, status: 'COMPLETED' },
      });

      return {
        callId,
        durationSec: billedSec,
        studentBalanceAfter: newStudentBalance,
        teacherEarnedSec: billedSec,
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

  async getBalance(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) throw new BadRequestException('User is not a student');

    const seconds = await this.getStudentBalanceSeconds(student.id);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return {
      balanceSeconds: seconds,
      formatted: `${mins}:${secs.toString().padStart(2, '0')}`,
    };
  }
    async getCallForTeacher(userId: string, callId: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({ where: { userId } });
    if (!teacher) throw new BadRequestException('User is not a teacher');

    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        student: { include: { user: { select: { fullName: true } } } },
      },
    });
    if (!call) throw new NotFoundException('Call not found');
    if (call.teacherId !== teacher.id) {
      throw new ForbiddenException('This is not your call');
    }
    if (!call.agoraChannelId) {
      throw new BadRequestException('Call has no Agora channel');
    }

    const teacherUid = 2;

    return {
      callId: call.id,
      status: call.status,
      channelName: call.agoraChannelId,
      appId: process.env.AGORA_APP_ID,
      teacherUid,
      teacherToken: this.buildAgoraToken(call.agoraChannelId, teacherUid),
      studentName: call.student.user.fullName,
      startTime: call.startTime,
    };
  }

  
  // Auto-end calls that have been active for more than 2 hours
  // (protects against abandoned tabs, disconnected users, etc.)
  @Cron('0 */5 * * * *') // every 5 minutes
  async autoEndStaleCalls() {
    const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const result = await this.prisma.call.updateMany({
      where: {
        status: 'ACTIVE',
        startTime: { lt: cutoff },
      },
      data: {
        status: 'CANCELLED',
        endTime: new Date(),
      },
    });
    if (result.count > 0) {
      console.log(`[Cron] Auto-ended ${result.count} stale call(s)`);
    }
  }
    // Teacher polls this to see if any student is calling them
  async getActiveCallForTeacher(userId: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });
    if (!teacher) return null;

    return this.prisma.call.findFirst({
      where: {
        teacherId: teacher.id,
        status: 'ACTIVE',
      },
      include: {
        student: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });
  }
}