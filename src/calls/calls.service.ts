import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
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
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpireTime = currentTimestamp + 3600;
    return RtcTokenBuilder.buildTokenWithUid(
      appId, appCertificate, channelName, uid, RtcRole.PUBLISHER,
      privilegeExpireTime, privilegeExpireTime,
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

  // ---------- Settlement (shared) ----------

  async endCall(userId: string, callId: string) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');

    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student || student.id !== call.studentId) {
      throw new ForbiddenException('This is not your call');
    }
    return this.settleCallInternal(callId, undefined, 'STUDENT_ENDED');
  }

  /**
   * Called by the gateway. Skips ownership check (server-authoritative end).
   * overrideDurationSec lets the gateway pass the "effective" duration
   * (wall clock minus pauses) instead of recomputing from startTime.
   */
   async endCallById(
    callId: string,
    overrideDurationSec?: number,
    endReason?: 'NATURAL' | 'TEACHER_ENDED' | 'STUDENT_ENDED' | 'NO_BALANCE' | 'DISCONNECTED' | 'ERROR',
  ) {
    return this.settleCallInternal(callId, overrideDurationSec, endReason);
  }

  private async settleCallInternal(
    callId: string,
    overrideDurationSec?: number,
    endReason?:
      | 'NATURAL'
      | 'TEACHER_ENDED'
      | 'STUDENT_ENDED'
      | 'NO_BALANCE'
      | 'DISCONNECTED'
      | 'ERROR',
  ) {
    const call = await this.prisma.call.findUnique({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    if (call.status !== 'ACTIVE') {
      throw new BadRequestException('Call is not active');
    }

    const endTime = new Date();
    const rawDurationSec =
      overrideDurationSec ??
      Math.max(0, Math.floor((endTime.getTime() - new Date(call.startTime).getTime()) / 1000));

    return this.prisma.$transaction(async (tx) => {
      const lastStudentEntry = await tx.minuteLedgerEntry.findFirst({
        where: { studentId: call.studentId },
        orderBy: { createdAt: 'desc' },
      });
      const currentStudentBalance = lastStudentEntry?.balanceAfter ?? 0;

      // Clamp to balance — no overage
      const billedSec = Math.min(rawDurationSec, currentStudentBalance);
      const newStudentBalance = currentStudentBalance - billedSec;

      await tx.minuteLedgerEntry.create({
        data: {
          studentId: call.studentId,
          type: 'CALL_USAGE',
          seconds: -billedSec,
          balanceAfter: newStudentBalance,
          referenceId: call.id,
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
          referenceId: call.id,
          note: `Lesson completed`,
        },
      });

      const updated = await tx.call.update({
        where: { id: callId },
        data: {
          endTime,
          durationSec: billedSec,
          status: 'COMPLETED',
          endReason: endReason ?? 'NATURAL',
        },
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

  // ---------- Lookups for the gateway ----------

  async getCallParticipants(callId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: {
        student: { include: { user: { select: { id: true, fullName: true } } } },
        teacher: { include: { user: { select: { id: true, fullName: true } } } },
      },
    });
    if (!call) return null;
    return {
      callId: call.id,
      status: call.status,
      studentId: call.studentId,
      studentUserId: call.student.user.id,
      teacherId: call.teacherId,
      teacherUserId: call.teacher.user.id,
      serviceType: call.serviceType,
      startTime: call.startTime,
    };
  }

  async getStudentBalanceSecondsPublic(studentProfileId: string) {
    return this.getStudentBalanceSeconds(studentProfileId);
  }

  // ---------- Audit log ----------

  async logCallEvent(
    callId: string,
    actorId: string | null,
    action: string,
    payload?: any,
  ) {
    try {
      await this.prisma.callEventLog.create({
        data: { callId, actorId, action, payload: payload ?? undefined },
      });
    } catch (err: any) {
      // Never let logging break the call
      console.warn(`CallEventLog write failed: ${err.message}`);
    }
  }

  // ---------- Existing helpers ----------

  async getActiveCall(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({ where: { userId } });
    if (!student) return null;
    return this.prisma.call.findFirst({
      where: { studentId: student.id, status: 'ACTIVE' },
      include: { teacher: { include: { user: { select: { fullName: true } } } } },
    });
  }

  async getActiveCallForTeacher(userId: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({ where: { userId } });
    if (!teacher) return null;
    return this.prisma.call.findFirst({
      where: { teacherId: teacher.id, status: 'ACTIVE' },
      include: { student: { include: { user: { select: { fullName: true } } } } },
      orderBy: { startTime: 'desc' },
    });
  }

  async getCallForTeacher(userId: string, callId: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({ where: { userId } });
    if (!teacher) throw new BadRequestException('User is not a teacher');

    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      include: { student: { include: { user: { select: { fullName: true } } } } },
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
 }