import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { CallsService } from './calls.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

interface SessionState {
  callId: string;
  studentUserId: string;
  studentProfileId: string;
  teacherUserId: string;
  teacherProfileId: string;
  startTimeMs: number;
  initialBalanceSeconds: number;
  pausedAtMs: number | null;
  totalPausedMs: number;
  pausedUserIds: Set<string>;
  userPausedAtMs: Map<string, number>;
  userPausedTotalMs: Map<string, number>;
  connectedUserIds: Set<string>;
  broadcastTimer: NodeJS.Timeout | null;
  ended: boolean;
}

type CallEndReason =
  | 'NATURAL'
  | 'TEACHER_ENDED'
  | 'STUDENT_ENDED'
  | 'NO_BALANCE'
  | 'DISCONNECTED'
  | 'ERROR';

@WebSocketGateway({
  namespace: '/calls',
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
})
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(CallsGateway.name);
  private sessions = new Map<string, SessionState>();

  constructor(
    private callsService: CallsService,
    private prisma: PrismaService,
  ) {}

  // ---------- Connection ----------

  async handleConnection(client: Socket) {
    try {
      const rawToken = String(client.handshake.auth?.token ?? '');
      const token = rawToken.replace(/^Bearer\s+/i, '');
      if (!token) throw new Error('No token');
      const secret = process.env.JWT_SECRET || 'change-me';
      const decoded: any = jwt.verify(token, secret);
      client.data.userId = decoded.sub;
      client.data.role = decoded.role;
      this.logger.log(`Socket connected: user=${decoded.sub} role=${decoded.role}`);
    } catch (err: any) {
      this.logger.warn(`Socket rejected: ${err.message}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const callId = client.data.callId;
    if (!callId) return;
    const session = this.sessions.get(callId);
    if (!session) return;

    session.connectedUserIds.delete(client.data.userId);
    await this.callsService.logCallEvent(callId, client.data.userId, 'user_leave', {
      remaining: session.connectedUserIds.size,
    });

    this.server.to(`call:${callId}`).emit('participant_left', {
      userId: client.data.userId,
      remaining: session.connectedUserIds.size,
    });

    if (session.connectedUserIds.size === 0 && !session.ended) {
      this.logger.log(`All participants left call ${callId} — settling`);
      await this.settleCall(callId, 'DISCONNECTED', undefined, 'all_participants_left');
    }
  }

  // ---------- Join ----------

  @SubscribeMessage('join_room')
  async handleJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    const callId = body?.callId;
    if (!callId) return { error: 'callId_required' };

    const participants = await this.callsService.getCallParticipants(callId);
    if (!participants) return { error: 'call_not_found' };
    if (participants.status !== 'ACTIVE') return { error: 'call_not_active' };

    const userId = client.data.userId;
    const isStudent = userId === participants.studentUserId;
    const isTeacher = userId === participants.teacherUserId;
    const isAdmin = client.data.role === 'ADMIN';
    if (!isStudent && !isTeacher && !isAdmin) {
      return { error: 'not_a_participant' };
    }

    let session = this.sessions.get(callId);
    if (!session) {
      const balanceSeconds = await this.callsService.getStudentBalanceSecondsPublic(
        participants.studentId,
      );
      session = {
        callId,
        studentUserId: participants.studentUserId,
        studentProfileId: participants.studentId,
        teacherUserId: participants.teacherUserId,
        teacherProfileId: participants.teacherId,
        startTimeMs: new Date(participants.startTime).getTime(),
        initialBalanceSeconds: balanceSeconds,
        pausedAtMs: null,
        totalPausedMs: 0,
        pausedUserIds: new Set(),
        userPausedAtMs: new Map(),
        userPausedTotalMs: new Map(),
        connectedUserIds: new Set(),
        broadcastTimer: null,
        ended: false,
      };
      this.sessions.set(callId, session);
    }

    client.data.callId = callId;
    client.data.role_in_call = isAdmin ? 'ADMIN' : isTeacher ? 'TEACHER' : 'STUDENT';
    client.join(`call:${callId}`);
    session.connectedUserIds.add(userId);

    await this.callsService.logCallEvent(callId, userId, 'user_join', {
      role: client.data.role_in_call,
    });

    this.server.to(`call:${callId}`).emit('participant_joined', {
      userId,
      role: client.data.role_in_call,
      connected: session.connectedUserIds.size,
    });

    if (!session.broadcastTimer) {
      this.startBroadcastLoop(callId);
    }

    const state = this.computeTimerState(session);
    return {
      ok: true,
      callId,
      studentUserId: session.studentUserId,
      teacherUserId: session.teacherUserId,
      role: client.data.role_in_call,
      ...state,
    };
  }

  // ---------- Timer loop (5-second sync) ----------

  private startBroadcastLoop(callId: string) {
    const session = this.sessions.get(callId);
    if (!session) return;

    const tick = () => {
      const s = this.sessions.get(callId);
      if (!s || s.ended) return;

      const state = this.computeTimerState(s);
      this.server.to(`call:${callId}`).emit('timer_sync', state);

      if (state.remainingSeconds <= 0 && !s.ended) {
        this.logger.log(`Call ${callId} reached 0 balance — auto-ending`);
        void this.settleCall(callId, 'NO_BALANCE', undefined, 'balance_zero');
      }
    };

    session.broadcastTimer = setInterval(tick, 5000);
    tick();
  }

  private computeTimerState(session: SessionState) {
    const now = Date.now();
    let elapsedMs = now - session.startTimeMs - session.totalPausedMs;
    if (session.pausedAtMs) {
      elapsedMs -= now - session.pausedAtMs;
    }
    elapsedMs = Math.max(0, elapsedMs);
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const remainingSeconds = Math.max(0, session.initialBalanceSeconds - elapsedSeconds);
    return {
      isPaused: session.pausedAtMs !== null,
      elapsedSeconds,
      remainingSeconds,
      initialBalanceSeconds: session.initialBalanceSeconds,
    };
  }

  // ---------- Control helpers ----------

  private async assertControl(client: Socket, callId: string) {
    const session = this.sessions.get(callId);
    if (!session) return { ok: false as const, error: 'session_not_found' };
    if (session.ended) return { ok: false as const, error: 'session_ended' };
    const role = client.data.role_in_call;
    if (role !== 'TEACHER' && role !== 'ADMIN') {
      return { ok: false as const, error: 'forbidden' };
    }
    return { ok: true as const, session };
  }

  // ---------- Control events ----------

  @SubscribeMessage('pause_all')
  async handlePauseAll(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    const auth = await this.assertControl(client, body?.callId);
    if (!auth.ok) return { error: auth.error };
    const session = auth.session;
    if (session.pausedAtMs) return { ok: true, alreadyPaused: true };

    session.pausedAtMs = Date.now();
    await this.callsService.logCallEvent(body.callId, client.data.userId, 'pause_all', null);

    const state = this.computeTimerState(session);
    this.server.to(`call:${body.callId}`).emit('timer_sync', state);
    this.server.to(`call:${body.callId}`).emit('paused_by', { byUserId: client.data.userId });
    return { ok: true };
  }

  @SubscribeMessage('resume_all')
  async handleResumeAll(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    const auth = await this.assertControl(client, body?.callId);
    if (!auth.ok) return { error: auth.error };
    const session = auth.session;
    if (!session.pausedAtMs) return { ok: true, alreadyRunning: true };

    session.totalPausedMs += Date.now() - session.pausedAtMs;
    session.pausedAtMs = null;

    await this.callsService.logCallEvent(body.callId, client.data.userId, 'resume_all', null);
    const state = this.computeTimerState(session);
    this.server.to(`call:${body.callId}`).emit('timer_sync', state);
    this.server.to(`call:${body.callId}`).emit('resumed_by', { byUserId: client.data.userId });
    return { ok: true };
  }

  @SubscribeMessage('add_time')
  async handleAddTime(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; seconds?: number },
  ) {
    const auth = await this.assertControl(client, body?.callId);
    if (!auth.ok) return { error: auth.error };
    const session = auth.session;

    const seconds = Math.max(1, Math.min(600, body?.seconds ?? 60));

    try {
      const lastEntry = await this.prisma.minuteLedgerEntry.findFirst({
        where: { studentId: session.studentProfileId },
        orderBy: { createdAt: 'desc' },
      });
      const currentBalance = lastEntry?.balanceAfter ?? 0;
      await this.prisma.minuteLedgerEntry.create({
        data: {
          studentId: session.studentProfileId,
          type: 'ADMIN_ADJUSTMENT',
          seconds,
          balanceAfter: currentBalance + seconds,
          referenceId: body.callId,
          note: `Time added during call by ${client.data.userId}`,
        },
      });
    } catch (err: any) {
      this.logger.error(`add_time ledger write failed: ${err.message}`);
      return { error: 'ledger_write_failed' };
    }

    session.initialBalanceSeconds += seconds;
    await this.callsService.logCallEvent(body.callId, client.data.userId, 'add_time', { seconds });

    const state = this.computeTimerState(session);
    this.server.to(`call:${body.callId}`).emit('timer_sync', state);
    this.server.to(`call:${body.callId}`).emit('time_added', {
      seconds,
      byUserId: client.data.userId,
      newInitialBalance: session.initialBalanceSeconds,
    });
    return { ok: true, ...state };
  }

  @SubscribeMessage('pause_student_timer')
  async handlePauseStudentTimer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    const auth = await this.assertControl(client, body?.callId);
    if (!auth.ok) return { error: auth.error };
    const session = auth.session;
    const targetUserId = session.studentUserId;

    if (!session.pausedUserIds.has(targetUserId)) {
      session.pausedUserIds.add(targetUserId);
      session.userPausedAtMs.set(targetUserId, Date.now());
    }

    await this.callsService.logCallEvent(
      body.callId,
      client.data.userId,
      'pause_student_timer',
      { targetUserId },
    );

    this.server.to(`call:${body.callId}`).emit('student_timer_paused', {
      targetUserId,
      byUserId: client.data.userId,
    });
    return { ok: true };
  }

  @SubscribeMessage('resume_student_timer')
  async handleResumeStudentTimer(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    const auth = await this.assertControl(client, body?.callId);
    if (!auth.ok) return { error: auth.error };
    const session = auth.session;
    const targetUserId = session.studentUserId;

    if (session.pausedUserIds.has(targetUserId)) {
      const startedAt = session.userPausedAtMs.get(targetUserId) ?? Date.now();
      const prev = session.userPausedTotalMs.get(targetUserId) ?? 0;
      session.userPausedTotalMs.set(targetUserId, prev + (Date.now() - startedAt));
      session.pausedUserIds.delete(targetUserId);
      session.userPausedAtMs.delete(targetUserId);
    }

    await this.callsService.logCallEvent(
      body.callId,
      client.data.userId,
      'resume_student_timer',
      { targetUserId },
    );

    this.server.to(`call:${body.callId}`).emit('student_timer_resumed', {
      targetUserId,
      byUserId: client.data.userId,
    });
    return { ok: true };
  }

  @SubscribeMessage('mute_student')
  async handleMuteStudent(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string; muted: boolean },
  ) {
    const auth = await this.assertControl(client, body?.callId);
    if (!auth.ok) return { error: auth.error };
    const session = auth.session;
    const targetUserId = session.studentUserId;

    await this.callsService.logCallEvent(body.callId, client.data.userId, 'mute_student', {
      targetUserId,
      muted: !!body.muted,
    });

    this.server.to(`call:${body.callId}`).emit('student_mute', {
      targetUserId,
      muted: !!body.muted,
      byUserId: client.data.userId,
    });
    return { ok: true };
  }

  @SubscribeMessage('end_session')
  async handleEndSession(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { callId: string },
  ) {
    const session = this.sessions.get(body?.callId);
    if (!session) return { error: 'session_not_found' };
    if (session.ended) return { ok: true, alreadyEnded: true };

    const role = client.data.role_in_call;
    if (role !== 'STUDENT' && role !== 'TEACHER' && role !== 'ADMIN') {
      return { error: 'forbidden' };
    }

    await this.callsService.logCallEvent(body.callId, client.data.userId, 'end_session', {
      byRole: role,
    });

    const endReason: CallEndReason =
      role === 'STUDENT' ? 'STUDENT_ENDED' : 'TEACHER_ENDED';

    await this.settleCall(body.callId, endReason, client.data.userId, 'manual_end');
    return { ok: true };
  }

  // ---------- Settlement ----------

  private async settleCall(
    callId: string,
    endReason: CallEndReason,
    actorUserId?: string,
    wireReason?: string,
  ) {
    const session = this.sessions.get(callId);
    if (!session || session.ended) return;
    session.ended = true;

    if (session.broadcastTimer) {
      clearInterval(session.broadcastTimer);
      session.broadcastTimer = null;
    }

    const state = this.computeTimerState(session);
    const effectiveDurationSec = state.elapsedSeconds;

    await this.callsService.logCallEvent(
      callId,
      actorUserId ?? null,
      `session_ended:${endReason.toLowerCase()}`,
      { effectiveDurationSec },
    );

    this.server.to(`call:${callId}`).emit('session_ended', {
      reason: wireReason ?? endReason.toLowerCase(),
      endReason,
      effectiveDurationSec,
    });

    try {
      await this.callsService.endCallById(callId, effectiveDurationSec, endReason);
    } catch (err: any) {
      this.logger.error(`Settlement failed for ${callId}: ${err.message}`);
    }

    this.sessions.delete(callId);
    this.server.in(`call:${callId}`).socketsLeave(`call:${callId}`);
  }
}