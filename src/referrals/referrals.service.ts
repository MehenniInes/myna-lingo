import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ReferralsService {
  constructor(private prisma: PrismaService) {}

  // Generate a unique referral code like MOH123 or AMINA4
  private generateCode(fullName: string): string {
    const base = fullName
      .replace(/[^a-zA-Z]/g, '')
      .slice(0, 5)
      .toUpperCase() || 'USER';
    const num = Math.floor(100 + Math.random() * 900); // 100-999
    return `${base}${num}`;
  }

  // Called when a new user registers
  async generateReferralCode(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;

    // Try up to 5 times to get a unique code
    for (let i = 0; i < 5; i++) {
      const code = this.generateCode(user.fullName);
      const existing = await this.prisma.user.findFirst({
        where: { referralCode: code } as any,
      });
      if (!existing) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { referralCode: code },
        });
        return code;
      }
    }
    return null;
  }

  // Called from /auth/register if ?ref=CODE was provided
  async processReferral(newUserId: string, refCode: string, signupIp?: string) {
    const newUser = await this.prisma.user.findUnique({
      where: { id: newUserId },
    });
    if (!newUser) throw new NotFoundException('New user not found');

    // Don't reward if user already has a referrer (safety)
    if ((newUser as any).referredByUserId) {
      return { rewarded: false, reason: 'already_referred' };
    }

    const inviter = await this.prisma.user.findFirst({
      where: { referralCode: refCode } as any,
    });
    if (!inviter) {
      return { rewarded: false, reason: 'invalid_code' };
    }

    // Don't allow self-referral
    if (inviter.id === newUserId) {
      return { rewarded: false, reason: 'self_referral' };
    }

    // ✅ LIMIT: only 1 successful referral per inviter
    const existingReward = await this.prisma.referralReward.findFirst({
      where: { inviterId: inviter.id },
    });
    if (existingReward) {
      // Still link the new user, but no reward
      await this.prisma.user.update({
        where: { id: newUserId },
        data: { referredByUserId: inviter.id },
      });
      return { rewarded: false, reason: 'inviter_limit_reached' };
    }

    // Anti-fraud: don't reward if same IP as inviter's last signup
    if (signupIp) {
      const ipMatch = await this.prisma.referralReward.findFirst({
        where: { signupIp, inviterId: inviter.id },
      });
      if (ipMatch) {
        return { rewarded: false, reason: 'same_ip' };
      }
    }

    // ✅ SUCCESS: link + reward
    return this.prisma.$transaction(async (tx) => {
      // Link the new user to the inviter
      await tx.user.update({
        where: { id: newUserId },
        data: { referredByUserId: inviter.id },
      });

      // Create the reward record
      const reward = await (tx as PrismaService).referralReward.create({
        data: {
          inviterId: inviter.id,
          invitedId: newUserId,
          minutesGiven: 10,
          signupIp: signupIp || null,
        },
      });

      // Find the inviter's student profile
      const inviterStudent = await tx.studentProfile.findUnique({
        where: { userId: inviter.id },
      });

      // Only reward if the inviter is a student (has a ledger)
      if (inviterStudent) {
        const lastEntry = await tx.minuteLedgerEntry.findFirst({
          where: { studentId: inviterStudent.id },
          orderBy: { createdAt: 'desc' },
        });
        const currentBalance = lastEntry?.balanceAfter ?? 0;
        const secondsToAdd = 10 * 60; // 10 minutes

        await tx.minuteLedgerEntry.create({
          data: {
            studentId: inviterStudent.id,
            type: 'ADMIN_ADJUSTMENT',
            seconds: secondsToAdd,
            balanceAfter: currentBalance + secondsToAdd,
            referenceId: reward.id,
            note: 'Referral reward — 10 free minutes',
          },
        });
      }

      // Notify the inviter
      await tx.notification.create({
        data: {
          userId: inviter.id,
          type: 'MINUTES_ADDED',
          title: 'Referral Bonus! 🎁',
          message: `Your friend ${newUser.fullName} joined Myna Lingo. You earned 10 free minutes!`,
          data: { rewardId: reward.id },
        },
      });

      return { rewarded: true, minutesGiven: 10, reward };
    });
  }

  // GET /referrals/my-link
  async getMyLink(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        referralCode: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');

    // Auto-generate if missing
    let code: string | null = user.referralCode;
    if (!code) {
      code = await this.generateReferralCode(userId);
    }

    return {
      code: code || '',
      url: `https://mynalingo.com/register?ref=${code}`,
    };
  }

  // GET /referrals/my-rewards
  async getMyRewards(userId: string) {
    const rewards = await this.prisma.referralReward.findMany({
      where: { inviterId: userId },
      include: {
        invited: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalMinutes = rewards.reduce((s: any, r: { minutesGiven: any; }) => s + r.minutesGiven, 0);
    const canStillEarn = rewards.length === 0;

    return {
      totalMinutes,
      canStillEarn,
      rewards: rewards.map((r: { id: any; invited: { fullName: any; }; minutesGiven: any; createdAt: any; }) => ({
        id: r.id,
        friendName: r.invited.fullName,
        minutesGiven: r.minutesGiven,
        createdAt: r.createdAt,
      })),
    };
  }
}