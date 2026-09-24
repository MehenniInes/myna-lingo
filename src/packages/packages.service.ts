import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PackagesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.package.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async findOne(id: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    return pkg;
  }

  async purchase(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
    });
    if (!pkg || !pkg.isActive) {
      throw new NotFoundException('Package not found or inactive');
    }

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new BadRequestException('User is not a student');
    }

    const lastEntry = await this.prisma.minuteLedgerEntry.findFirst({
      where: { studentId: student.id },
      orderBy: { createdAt: 'desc' },
    });
    const currentBalance = lastEntry?.balanceAfter ?? 0;
    const secondsToAdd = pkg.minutes * 60;

    return this.prisma.$transaction(async (tx) => {
      const purchase = await tx.packagePurchase.create({
        data: {
          studentId: student.id,
          packageId: pkg.id,
        },
      });

      await tx.minuteLedgerEntry.create({
        data: {
          studentId: student.id,
          type: 'PACKAGE_PURCHASE',
          seconds: secondsToAdd,
          balanceAfter: currentBalance + secondsToAdd,
          referenceId: purchase.id,
          note: `Purchased ${pkg.minutes} minutes package`,
        },
      });

      return {
        purchaseId: purchase.id,
        minutesAdded: pkg.minutes,
        newBalanceSeconds: currentBalance + secondsToAdd,
      };
    });
  }
}