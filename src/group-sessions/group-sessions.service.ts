import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class GroupSessionsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  // ============ START A SESSION ============
  async startSession(userId: string, groupClassId: string) {
    const groupClass = await this.prisma.groupClass.findUnique({
      where: { id: groupClassId },
      include: { participants: true },
    });
    if (!groupClass) throw new NotFoundException('Group class not found');

    // End any existing active session
    await this.prisma.groupSession.updateMany({
      where: { groupClassId, status: 'ACTIVE' },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });

    // Generate unique room id
    const roomId = `room_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const session = await this.prisma.groupSession.create({
      data: {
        groupClassId,
        roomId,
        status: 'ACTIVE',
        createdBy: userId,
      },
    });

    // Notify all past participants (except creator)
    const notifications = groupClass.participants.map((p) =>
      this.notifications.create(
        p.studentId,
        'CHILD_BOOKING',
        'Group class is live! 👥',
        `"${groupClass.title}" is starting now. Join the room!`,
        { sessionId: session.id, groupClassId },
      ),
    );
    await Promise.allSettled(notifications);

    return session;
  }

  // ============ GET SESSION DETAILS ============
  async getSession(id: string) {
    const session = await this.prisma.groupSession.findUnique({
      where: { id },
      include: {
        groupClass: {
          include: {
            language: true,
            teacher: { include: { user: { select: { fullName: true } } } },
          },
        },
        participants: {
          include: {
            user: { select: { id: true, fullName: true } },
          },
        },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  // ============ JOIN SESSION ============
  async join(userId: string, sessionId: string) {
    const session = await this.prisma.groupSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'ACTIVE') throw new BadRequestException('Session is not active');

    return this.prisma.roomPresence.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      create: {
        sessionId,
        userId,
        status: 'IN_CALL',
      },
      update: {
        status: 'IN_CALL',
        lastSeenAt: new Date(),
        leftAt: null,
      },
    });
  }

  // ============ LEAVE SESSION ============
    async leave(userId: string, sessionId: string) {
    const presence = await this.prisma.roomPresence.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (!presence) throw new NotFoundException('You are not in this session');

    const updated = await this.prisma.roomPresence.update({
      where: { sessionId_userId: { sessionId, userId } },
      data: { status: 'LEFT', leftAt: new Date() },
    });

    // ✅ Auto-end session if no one is IN_CALL anymore
    const remaining = await this.prisma.roomPresence.count({
      where: { sessionId, status: 'IN_CALL' },
    });
    if (remaining === 0) {
      await this.prisma.groupSession.update({
        where: { id: sessionId },
        data: { status: 'COMPLETED', endedAt: new Date() },
      });
    }

    return updated;
  }

  // ============ HEARTBEAT ============
  async heartbeat(userId: string, sessionId: string) {
    const presence = await this.prisma.roomPresence.findUnique({
      where: { sessionId_userId: { sessionId, userId } },
    });
    if (!presence) throw new NotFoundException('You are not in this session');

    return this.prisma.roomPresence.update({
      where: { sessionId_userId: { sessionId, userId } },
      data: {
        status: 'IN_CALL',
        lastSeenAt: new Date(),
      },
    });
  }

  // ============ RECONNECT ============
  async reconnect(userId: string, sessionId: string) {
    return this.join(userId, sessionId);
  }

  // ============ GET MY ACTIVE SESSION ============
  async getMyActiveSession(userId: string) {
    const presence = await this.prisma.roomPresence.findFirst({
      where: {
        userId,
        status: { in: ['IN_CALL', 'DISCONNECTED_PENDING'] },
        session: { status: 'ACTIVE' },
      },
      include: {
        session: {
          include: {
            groupClass: {
              include: {
                teacher: { include: { user: { select: { fullName: true } } } },
              },
            },
            participants: {
              where: { status: 'IN_CALL' },
              include: { user: { select: { fullName: true } } },
            },
          },
        },
      },
    });
    return presence;
  }

  // ============ END SESSION ============
  async endSession(userId: string, sessionId: string) {
    const session = await this.prisma.groupSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.createdBy !== userId) {
      throw new ForbiddenException('Only the creator can end the session');
    }

    return this.prisma.groupSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', endedAt: new Date() },
    });
  }

  // ============ AUTO-DISCONNECT (runs every 20s) ============
  @Cron('*/20 * * * * *')
  async checkDisconnects() {
    const cutoff = new Date(Date.now() - 30_000);

    await this.prisma.roomPresence.updateMany({
      where: {
        status: 'IN_CALL',
        lastSeenAt: { lt: cutoff },
      },
      data: { status: 'DISCONNECTED_PENDING' },
    });
  }
}