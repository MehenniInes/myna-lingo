import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { ChatService } from './chat.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private chatService: ChatService,
    private prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const rawToken = String(client.handshake.auth?.token ?? '');
      const token = rawToken.replace(/^Bearer\s+/i, '');
      if (!token) throw new Error('No token');
      const secret = process.env.JWT_SECRET || 'change-me';
      const decoded: any = jwt.verify(token, secret);
      client.data.userId = decoded.sub;
      
      // كل مستخدم كيدخل لـ Room خاص بيه
      client.join(`user:${decoded.sub}`);
      this.logger.log(`Chat socket connected: user=${decoded.sub}`);
    } catch (err: any) {
      this.logger.warn(`Chat socket rejected: ${err.message}`);
      client.disconnect(true);
    }
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { receiverId: string; content: string },
  ) {
    const senderId = client.data.userId;
    if (!senderId || !body.receiverId || !body.content) return { error: 'invalid_data' };

    const msg = await this.chatService.saveMessage(senderId, body.receiverId, body.content);

    // 1. سجل الإشعار فـ الداتابيز
    await this.prisma.notification.create({
      data: {
        userId: body.receiverId,
        type: 'CHAT_MESSAGE',
        title: 'New Message 💬',
        message: `New message from ${msg.sender.fullName}`,
        data: { senderId: msg.senderId, chatId: msg.id },
      },
    });

    // 2. صيفط إشارة الإشعار للـ Frontend (باش تطلع الكارطة)
    this.server.to(`user:${body.receiverId}`).emit('new_notification', {
      title: 'New Message 💬',
      message: `New message from ${msg.sender.fullName}`,
    });

    // صيفط الرسالة للـ Receiver
    this.server.to(`user:${body.receiverId}`).emit('new_message', msg);
    // صيفطها حتى للـ Sender
    this.server.to(`user:${senderId}`).emit('new_message', msg);

    return { ok: true, message: msg };
  }

   @SubscribeMessage('mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { senderId: string },
  ) {
    const receiverId = client.data.userId;
    if (!receiverId || !body.senderId) return { error: 'invalid_data' };

    console.log(`[MarkRead] User ${receiverId} is marking messages from ${body.senderId} as read`);

    await this.chatService.markAsRead(receiverId, body.senderId);
    
    // صيفط الإشارة للشخص اللي صيفط الرسالة
    this.server.to(`user:${body.senderId}`).emit('messages_read', { by: receiverId });
    console.log(`[MarkRead] Emitted messages_read to user:${body.senderId}`);
    
    return { ok: true };

  }
}