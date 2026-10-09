import { Injectable, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ReferralsService } from '../referrals/referrals.service.js';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private referrals: ReferralsService,
  ) {}

  async create(data: {
    email: string;
    password: string;
    fullName: string;
    role: 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN';
    refCode?: string;
    signupIp?: string;
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const referralCode = await this.generateUniqueReferralCode(data.fullName);

    // Transaction: user + profile must both succeed or both fail
    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          fullName: data.fullName,
          role: data.role,
          referralCode,
        },
      });

      if (data.role === 'STUDENT') {
        await tx.studentProfile.create({
          data: { userId: newUser.id },
        });
      } else if (data.role === 'PARENT') {
        await tx.parentProfile.create({
          data: { userId: newUser.id },
        });
      } else if (data.role === 'TEACHER') {
        await tx.teacherProfile.create({
          data: { userId: newUser.id },
        });
      }

      return newUser;
    });

    // Process referral AFTER user + profile are committed
    if (data.refCode && data.role === 'STUDENT') {
      try {
        await this.referrals.processReferral(
          user.id,
          data.refCode,
          data.signupIp,
        );
      } catch {
        // silent — don't fail signup if referral fails
      }
    }

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  // Generate a unique referral code like "AMINA123"
  private async generateUniqueReferralCode(fullName: string): Promise<string> {
    const base =
      fullName
        .replace(/[^a-zA-Z]/g, '')
        .slice(0, 5)
        .toUpperCase() || 'USER';

    for (let i = 0; i < 10; i++) {
      const code = `${base}${Math.floor(100 + Math.random() * 900)}`;
      const existing = await this.prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!existing) return code;
    }

    // Fallback: use timestamp if 10 attempts failed (very unlikely)
    return `${base}${Date.now().toString().slice(-5)}`;
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }
}