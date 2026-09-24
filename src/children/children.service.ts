import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ChildrenService {
  constructor(private prisma: PrismaService) {}

  private calculateAgeCategory(dateOfBirth: Date): 'AGE_6_11' | 'AGE_12_14' | null {
    const today = new Date();
    let age = today.getFullYear() - dateOfBirth.getFullYear();
    const monthDiff = today.getMonth() - dateOfBirth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) {
      age--;
    }

    if (age >= 6 && age <= 11) return 'AGE_6_11';
    if (age >= 12 && age <= 14) return 'AGE_12_14';
    return null;
  }

  private async getParentProfile(userId: string) {
    const parent = await this.prisma.parentProfile.findUnique({
      where: { userId },
    });
    if (!parent) {
      throw new BadRequestException('User is not a parent');
    }
    return parent;
  }

  async create(userId: string, data: { fullName: string; dateOfBirth: string }) {
    const parent = await this.getParentProfile(userId);

    const dob = new Date(data.dateOfBirth);
    if (isNaN(dob.getTime())) {
      throw new BadRequestException('Invalid date of birth');
    }

    const ageCategory = this.calculateAgeCategory(dob);
    if (!ageCategory) {
      throw new BadRequestException('Child must be between 6 and 14 years old');
    }

    // نصنعو User جديد للطفل (بلا إيميل، بلا باسورد - كيتسير من طرف الولي)
    // بدلاً من ذلك، نخليو الـ ChildProfile مرتبط بـ User وهمي ولا نستعملو الـ StudentProfile مباشرة

    // الطريقة الأبسط: نصنع User بـ email عشوائي و role STUDENT
    const childEmail = `child-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@mynalingo.local`;

    return this.prisma.$transaction(async (tx) => {
      const childUser = await tx.user.create({
        data: {
          email: childEmail,
          passwordHash: '', // ما عندوش باسورد، كيدخل من حساب الولي
          fullName: data.fullName,
          role: 'STUDENT',
          isActive: true,
        },
      });

      const studentProfile = await tx.studentProfile.create({
        data: {
          userId: childUser.id,
          parentId: parent.id,
          dateOfBirth: dob,
        },
      });

      return {
        id: studentProfile.id,
        fullName: childUser.fullName,
        dateOfBirth: studentProfile.dateOfBirth,
        ageCategory,
        userId: childUser.id,
      };
    });
  }

  async findAll(userId: string) {
    const parent = await this.getParentProfile(userId);

    const children = await this.prisma.studentProfile.findMany({
      where: { parentId: parent.id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });

    return children.map((c) => ({
      id: c.id,
      fullName: c.user.fullName,
      dateOfBirth: c.dateOfBirth,
      ageCategory: c.dateOfBirth ? this.calculateAgeCategory(c.dateOfBirth) : null,
      userId: c.user.id,
    }));
  }

  async findOne(userId: string, childId: string) {
    const parent = await this.getParentProfile(userId);

    const child = await this.prisma.studentProfile.findFirst({
      where: { id: childId, parentId: parent.id },
      include: { user: { select: { id: true, fullName: true, email: true } } },
    });

    if (!child) throw new NotFoundException('Child not found');

    return {
      id: child.id,
      fullName: child.user.fullName,
      dateOfBirth: child.dateOfBirth,
      ageCategory: child.dateOfBirth ? this.calculateAgeCategory(child.dateOfBirth) : null,
      userId: child.user.id,
    };
  }

  async remove(userId: string, childId: string) {
    const parent = await this.getParentProfile(userId);

    const child = await this.prisma.studentProfile.findFirst({
      where: { id: childId, parentId: parent.id },
    });
    if (!child) throw new NotFoundException('Child not found');

    await this.prisma.user.delete({ where: { id: child.userId } });
    return { success: true };
  }
}