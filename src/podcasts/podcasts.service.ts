import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
@Injectable()
export class PodcastsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async findAll() {
    return this.prisma.podcast.findMany({
      where: { isActive: true },
      include: { language: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id },
      include: {
        language: true,
        transcripts: { orderBy: { order: 'asc' } },
        vocabulary: true,
        questions: { orderBy: { order: 'asc' } },
      },
    });
    if (!podcast) throw new NotFoundException('Podcast not found');
    return podcast;
  }

    async purchase(userId: string, podcastId: string) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
    });
    if (!podcast || !podcast.isActive) {
      throw new NotFoundException('Podcast not found or inactive');
    }

    const existing = await this.prisma.podcastPurchase.findUnique({
      where: {
        userId_podcastId: { userId, podcastId },
      },
    });
    if (existing) {
      throw new BadRequestException('Podcast already purchased');
    }

    const purchase = await this.prisma.podcastPurchase.create({
      data: {
        userId,
        podcastId,
        priceDA: podcast.priceDA,
      },
    });

    // ✅ نصنعو إشعار
    await this.notifications.create(
      userId,
      'PODCAST_PURCHASED',
      'Podcast Purchased! 🎧',
      `You can now listen to "${podcast.title}".`,
      { podcastId, title: podcast.title },
    );

    return purchase;
  }

  async getMyPodcasts(userId: string) {
    return this.prisma.podcastPurchase.findMany({
      where: { userId },
      include: {
        podcast: { include: { language: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async saveProgress(userId: string, podcastId: string, lastPositionSec: number) {
    const podcast = await this.prisma.podcast.findUnique({
      where: { id: podcastId },
    });
    if (!podcast) throw new NotFoundException('Podcast not found');

    return this.prisma.podcastProgress.upsert({
      where: {
        userId_podcastId: { userId, podcastId },
      },
      update: { lastPositionSec },
      create: {
        userId,
        podcastId,
        lastPositionSec,
      },
    });
  }
}