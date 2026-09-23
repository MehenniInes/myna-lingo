import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class XpService {
  constructor(private prisma: PrismaService) {}

  async getBalance(userId: string) {
    const result = await this.prisma.xPTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    const totalXP = result._sum.amount ?? 0;
    const level = await this.calculateLevel(totalXP);

    return {
      totalXP,
      level: level.number,
      levelName: level.name,
      minXP: level.minXP,
      maxXP: level.maxXP,
      progressInLevel: totalXP - level.minXP,
      xpToNextLevel: level.maxXP - totalXP,
    };
  }

  async getTransactions(userId: string) {
    return this.prisma.xPTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async award(userId: string, amount: number, source: string, note?: string, referenceId?: string) {
    if (amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    return this.prisma.xPTransaction.create({
      data: {
        userId,
        amount,
        source: source as any,
        note,
        referenceId,
      },
    });
  }

  private async calculateLevel(totalXP: number) {
    // القاعدة: كل مستوى = 500 XP
    // Level 1: 0-499, Level 2: 500-999, Level 3: 1000-1499, إلخ
    const levelNumber = Math.floor(totalXP / 500) + 1;
    const minXP = (levelNumber - 1) * 500;
    const maxXP = levelNumber * 500;

    return {
      number: levelNumber,
      name: `Level ${levelNumber}`,
      minXP,
      maxXP,
    };
  }
}