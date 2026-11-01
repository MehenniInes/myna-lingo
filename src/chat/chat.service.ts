import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(
    senderId: string, 
    receiverId: string, 
    content: string | null, 
    type: string = 'TEXT', 
    fileUrl?: string, 
    fileName?: string
  ) {
    return this.prisma.chatMessage.create({
      data: { 
        senderId, 
        receiverId, 
        content, 
        type, 
        fileUrl, 
        fileName 
      },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
        receiver: { select: { id: true, fullName: true, role: true } },
      },
    });
  }

  async getHistory(userId: string, otherUserId: string, limit = 50) {
    return this.prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async getConversations(userId: string) {
    const messages = await this.prisma.chatMessage.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, fullName: true, role: true } },
        receiver: { select: { id: true, fullName: true, role: true } },
      },
    });

    const conversationsMap = new Map();

    for (const msg of messages) {
      const otherUser = msg.senderId === userId ? msg.receiver : msg.sender;
      if (!conversationsMap.has(otherUser.id)) {
        conversationsMap.set(otherUser.id, {
          user: otherUser,
          lastMessage: msg.type === 'IMAGE' ? '📷 Image' : msg.type === 'FILE' ? '📎 File' : msg.content,
          lastMessageAt: msg.createdAt,
        });
      }
    }

    return Array.from(conversationsMap.values());
  }

  async markAsRead(receiverId: string, senderId: string) {
    return this.prisma.chatMessage.updateMany({
      where: { receiverId, senderId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

      async getAvailableUsers(currentUserId: string) {
    // 👈 هنا قمنا بتغيير الكود باش يجيب الأساتذة فقط دايماً
    return this.prisma.user.findMany({
      where: {
        role: 'TEACHER', // فرضنا الدور يكون أستاذ
        id: { not: currentUserId },
      },
      select: { id: true, fullName: true, role: true },
    });
  }
}