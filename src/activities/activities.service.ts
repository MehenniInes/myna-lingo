import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { XpService } from '../xp/xp.service.js';

@Injectable()
export class ActivitiesService {
  constructor(
    private prisma: PrismaService,
    private xpService: XpService,
  ) {}

  async findAll(type?: string) {
    return this.prisma.learningActivity.findMany({
      where: {
        isActive: true,
        ...(type ? { type: type as any } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOne(id: string) {
    const activity = await this.prisma.learningActivity.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    });
    if (!activity) throw new NotFoundException('Activity not found');
    return activity;
  }

  async complete(userId: string, activityId: string) {
    const activity = await this.prisma.learningActivity.findUnique({
      where: { id: activityId },
    });
    if (!activity || !activity.isActive) {
      throw new NotFoundException('Activity not found or inactive');
    }

    // نمنحو XP
    const xp = await this.xpService.award(
      userId,
      activity.xpReward,
      'ACTIVITY_COMPLETION',
      `Completed activity: ${activity.title}`,
      activityId,
    );

    return {
      success: true,
      xpAwarded: activity.xpReward,
      transaction: xp,
    };
  }
}