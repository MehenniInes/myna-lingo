import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(senderId: string, receiverId: string, content: string) {
    return this.prisma.chatMessage.create({
      data: { senderId, receiverId, content },
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
    // هادي كترجع لائحة الناس اللي تهضرو معاهم
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
          lastMessage: msg.content,
          lastMessageAt: msg.createdAt,
          unreadCount: 0, // ممكن نحسبوها من بعد
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
    // 1. جيب المستخدم الحالي من الداتابيز باش نعرفو الـ role ديالو بالضبط
    const currentUser = await this.prisma.user.findUnique({
      where: { id: currentUserId },
    });

    if (!currentUser) return [];

    // 2. إلا كنتي طالب، جيب الأساتذة. إلا كنتي أستاذ، جيب الطلبة.
    const targetRole = currentUser.role === 'STUDENT' ? 'TEACHER' : 'STUDENT';

    return this.prisma.user.findMany({
      where: {
        role: targetRole as any,
        id: { not: currentUserId },
      },
      select: { id: true, fullName: true, role: true },
    });
  }
}