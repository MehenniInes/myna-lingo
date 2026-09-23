import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class MinutesService {
  constructor(private prisma: PrismaService) {}

  private async getStudentProfile(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new BadRequestException('User is not a student');
    }
    return student;
  }

  async getBalance(userId: string) {
    const student = await this.getStudentProfile(userId);

    const lastEntry = await this.prisma.minuteLedgerEntry.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });

    const balanceSeconds = lastEntry?.balanceAfter ?? 0;
    const minutes = Math.floor(balanceSeconds / 60);
    const seconds = balanceSeconds % 60;

    return {
      balanceSeconds,
      formatted: `${minutes}:${seconds.toString().padStart(2, '0')}`,
    };
  }

  async getLedger(userId: string) {
    const student = await this.getStudentProfile(userId);

    return this.prisma.minuteLedgerEntry.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}