import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class GroupClassesService {
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

  async findAll() {
    return this.prisma.groupClass.findMany({
      where: { isActive: true },
      include: {
        language: true,
        teacher: {
          include: {
            user: { select: { fullName: true } },
          },
        },
        participants: true,
      },
      orderBy: { startTime: 'asc' },
    });
  }

  async findOne(id: string) {
    const groupClass = await this.prisma.groupClass.findUnique({
      where: { id },
      include: {
        language: true,
        teacher: { include: { user: { select: { fullName: true } } } },
        participants: {
          include: {
            student: {
              include: {
                user: { select: { fullName: true } },
              },
            },
          },
        },
      },
    });
    if (!groupClass) throw new NotFoundException('Group class not found');
    return groupClass;
  }

  async join(userId: string, groupClassId: string) {
    const groupClass = await this.prisma.groupClass.findUnique({
      where: { id: groupClassId },
      include: { participants: true },
    });
    if (!groupClass || !groupClass.isActive) {
      throw new NotFoundException('Group class not found or inactive');
    }

    // نتأكدو أن الحصة ما زال ما بداتش
    if (new Date() >= groupClass.startTime) {
      throw new BadRequestException('Class has already started');
    }

    // نلقاو الـ StudentProfile
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!student) {
      throw new BadRequestException('User is not a student');
    }

    // نتأكدو أن الطفل فـ الفئة العمرية الصحيحة
    if (!student.dateOfBirth) {
      throw new BadRequestException('Student has no date of birth');
    }
    const studentAgeCategory = this.calculateAgeCategory(student.dateOfBirth);
    if (studentAgeCategory !== groupClass.ageCategory) {
      throw new BadRequestException(
        `This class is for ${groupClass.ageCategory === 'AGE_6_11' ? '6-11' : '12-14'} years old children`,
      );
    }

    // نتأكدو أن الحصة ما عامرة
    if (groupClass.participants.length >= groupClass.capacity) {
      throw new BadRequestException('Class is full');
    }

    // نتأكدو أنو ما مشتركش من قبل
    const existing = await this.prisma.groupParticipant.findUnique({
      where: {
        groupClassId_studentId: {
          groupClassId,
          studentId: student.id,
        },
      },
    });
    if (existing) {
      throw new BadRequestException('Already joined this class');
    }

    return this.prisma.groupParticipant.create({
      data: {
        groupClassId,
        studentId: student.id,
      },
    });
  }

  async getMyClasses(userId: string) {
    const student = await this.prisma.studentProfile.findUnique({
      where: { userId },
    });
    if (!student) throw new BadRequestException('User is not a student');

    return this.prisma.groupParticipant.findMany({
      where: { studentId: student.id },
      include: {
        groupClass: {
          include: {
            language: true,
            teacher: { include: { user: { select: { fullName: true } } } },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });
  }

  async getSessions(groupClassId: string) {
  return this.prisma.groupSession.findMany({
    where: { groupClassId },
    include: {
      participants: {
        where: { status: 'IN_CALL' },     // ← THIS LINE
        include: { user: { select: { id: true, fullName: true } } },
      },
    },
    orderBy: { startedAt: 'desc' },
    take: 10,
  });
}
}