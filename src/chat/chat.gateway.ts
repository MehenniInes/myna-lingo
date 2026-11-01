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
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
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
    @MessageBody() body: { receiverId: string; content?: string; type?: string; fileUrl?: string; fileName?: string },
  ) {
    const senderId = client.data.userId;
    if (!senderId || !body.receiverId) return { error: 'invalid_data' };
    
    // إلا ما كانش نص ولا ملف، ما نرسلو والو
    if (!body.content && !body.fileUrl) return { error: 'empty_message' };

    const msg = await this.chatService.saveMessage(
      senderId, 
      body.receiverId, 
      body.content || null, 
      body.type || 'TEXT', 
      body.fileUrl, 
      body.fileName
    );

    // الإشعار
    const notifTitle = body.type === 'IMAGE' ? 'New Image 📷' : body.type === 'FILE' ? 'New File 📎' : 'New Message 💬';
    const notifMessage = body.type === 'TEXT' ? `New message from ${msg.sender.fullName}` : `${msg.sender.fullName} sent an attachment`;

    await this.prisma.notification.create({
      data: {
        userId: body.receiverId,
        type: 'CHAT_MESSAGE',
        title: notifTitle,
        message: notifMessage,
        data: { senderId: msg.senderId, chatId: msg.id },
      },
    });

    this.server.to(`user:${body.receiverId}`).emit('new_notification', {
      title: notifTitle,
      message: notifMessage,
    });

    this.server.to(`user:${body.receiverId}`).emit('new_message', msg);
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

    await this.chatService.markAsRead(receiverId, body.senderId);
    this.server.to(`user:${body.senderId}`).emit('messages_read', { by: receiverId });
    return { ok: true };
  }
}