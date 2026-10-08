import { Injectable, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ApplyDto } from './dto/apply.dto.js';

@Injectable()
export class TeachersService {
  constructor(private prisma: PrismaService) {}

  async apply(userId: string, dto: ApplyDto) {
    const existing = await this.prisma.teacherProfile.findUnique({
      where: { userId },
    });

    if (existing && existing.applicationStatus !== 'REJECTED') {
      throw new ConflictException('Application already submitted or already approved');
    }

    const teacherProfile = await this.prisma.teacherProfile.upsert({
      where: { userId },
      create: {
        userId,
        bio: dto.bio,
        experienceYears: dto.experienceYears,
        introVideoUrl: dto.introVideoUrl,
        profilePhotoUrl: dto.profilePhotoUrl,
        idDocumentUrl: dto.idDocumentUrl,
        applicationStatus: 'PENDING_REVIEW',
        teacherLanguages: {
          create: dto.languages.map((l) => ({
            languageId: l.languageId,
            serviceType: l.serviceType,
            certificates: {
              create: l.certificateUrls.map((url) => ({ fileUrl: url })),
            },
          })),
        },
      },
      update: {
        bio: dto.bio,
        experienceYears: dto.experienceYears,
        introVideoUrl: dto.introVideoUrl,
        profilePhotoUrl: dto.profilePhotoUrl,
        idDocumentUrl: dto.idDocumentUrl,
        applicationStatus: 'PENDING_REVIEW',
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
      },
      include: { teacherLanguages: { include: { certificates: true } } },
    });

    return teacherProfile;
  }

  async updateSpokenLanguages(
    userId: string,
    languages: { languageId: string; level: string }[],
  ) {
    const profile = await this.prisma.teacherProfile.findUnique({ where: { userId } });
    if (!profile) throw new Error('Profile not found');

    await this.prisma.spokenLanguage.deleteMany({ where: { teacherId: profile.id } });

    await this.prisma.spokenLanguage.createMany({
      data: languages.map((l) => ({
        teacherId: profile.id,
        languageId: l.languageId,
        level: l.level as any,
      })),
    });

    return this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: { spokenLanguages: { include: { language: true } } },
    });
  }

  async updateProfilePhoto(userId: string, profilePhotoUrl: string) {
    return this.prisma.teacherProfile.update({
      where: { userId },
      data: { profilePhotoUrl },
    });
  }

  async listPendingApplications() {
    return this.prisma.teacherProfile.findMany({
      where: { applicationStatus: 'PENDING_REVIEW' },
      include: {
        user: { select: { email: true, fullName: true } },
        teacherLanguages: { include: { language: true, certificates: true } },
      },
    });
  }

  async reviewApplication(
    teacherId: string,
    adminUserId: string,
    decision: 'APPROVED' | 'REJECTED',
    note?: string,
  ) {
    return this.prisma.teacherProfile.update({
      where: { id: teacherId },
      data: {
        applicationStatus: decision,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        reviewNote: note,
      },
    });
  }

  async getOrCreateDraft(userId: string) {
    let profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: {
        spokenLanguages: { include: { language: true } },
        teacherLanguages: { include: { language: true, certificates: true } },
        educations: true,
      },
    });

    if (!profile) {
      profile = await this.prisma.teacherProfile.create({
        data: { userId, applicationStatus: 'DRAFT' },
        include: {
          spokenLanguages: { include: { language: true } },
          teacherLanguages: { include: { language: true, certificates: true } },
          educations: true,
        },
      });
    }

    return profile;
  }

  async updateAbout(
    userId: string,
    data: {
      firstName: string;
      lastName: string;
      countryOfBirth: string;
      phoneNumber?: string;
      confirmedOver18: boolean;
    },
  ) {
    return this.prisma.teacherProfile.update({
      where: { userId },
      data,
    });
  }

  async addCertificate(userId: string, dto: {
    teacherLanguageId: string;
    description?: string;
    issuedBy: string;
    yearFrom: number;
    yearTo: number;
    fileUrl: string;
  }) {
    if (dto.yearTo < dto.yearFrom) {
      throw new BadRequestException('End year cannot be before start year');
    }

    const teacherLanguage = await this.prisma.teacherLanguage.findUnique({
      where: { id: dto.teacherLanguageId },
      include: { teacher: true },
    });
    if (!teacherLanguage || teacherLanguage.teacher.userId !== userId) {
      throw new BadRequestException('Invalid teacher language reference');
    }

    return this.prisma.certificate.create({ data: dto });
  }

  async updateTeachingLanguages(
    userId: string,
    languages: { languageId: string; serviceType: string }[],
  ) {
    const profile = await this.prisma.teacherProfile.findUnique({ where: { userId } });
    if (!profile) throw new Error('Profile not found');

    await this.prisma.teacherLanguage.deleteMany({ where: { teacherId: profile.id } });

    for (const l of languages) {
      await this.prisma.teacherLanguage.create({
        data: {
          teacherId: profile.id,
          languageId: l.languageId,
          serviceType: l.serviceType as any,
        },
      });
    }

    return this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: { teacherLanguages: { include: { language: true, certificates: true } } },
    });
  }

  async becomeTeacher(userId: string) {
    const existing = await this.prisma.teacherProfile.findUnique({ where: { userId } });
    if (existing) return existing;

    return this.prisma.teacherProfile.create({
      data: { userId, applicationStatus: 'DRAFT' },
    });
  }

  async submitApplication(userId: string) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: { teacherLanguages: { include: { certificates: true } } },
    });

    if (!profile) {
      throw new BadRequestException('No application found');
    }
    if (profile.applicationStatus !== 'DRAFT') {
      throw new BadRequestException('Application already submitted');
    }
    if (!profile.idDocumentUrl) {
      throw new BadRequestException('ID document is required before submitting');
    }
    const hasCertificate = profile.teacherLanguages.some((tl) => tl.certificates.length > 0);
    if (!hasCertificate) {
      throw new BadRequestException('At least one certificate is required before submitting');
    }

    return this.prisma.teacherProfile.update({
      where: { userId },
      data: { applicationStatus: 'PENDING_REVIEW' },
    });
  }

  async updateIdDocument(userId: string, idDocumentUrl: string) {
    return this.prisma.teacherProfile.update({
      where: { userId },
      data: { idDocumentUrl },
    });
  }

  async getOnlineTeachers() {
    return this.prisma.teacherProfile.findMany({
      where: { isOnline: true, applicationStatus: 'APPROVED' },
      include: {
        user: { select: { fullName: true } },
        teacherLanguages: { include: { language: true } },
      },
    });
  }

  async addEducation(userId: string, dto: {
    university: string;
    degree: string;
    degreeType?: string;
    specialization?: string;
    yearFrom: number;
    yearTo: number;
    diplomaUrl?: string;
  }) {
    const profile = await this.prisma.teacherProfile.findUnique({ where: { userId } });
    if (!profile) throw new BadRequestException('Profile not found');

    return this.prisma.education.create({
      data: { teacherId: profile.id, ...dto },
    });
  }

  async updateDescription(userId: string, description: string) {
    return this.prisma.teacherProfile.update({
      where: { userId },
      data: { bio: description },
    });
  }

  async updateAvailability(userId: string, slots: { day: string; startTime: string; endTime: string }[]) {
    return this.prisma.teacherProfile.update({
      where: { userId },
      data: { availability: slots as any },
    });
  }

  async updatePricing(userId: string, requestedHourlyRateDA: number) {
    return this.prisma.teacherProfile.update({
      where: { userId },
      data: { requestedHourlyRateDA },
    });
  }

  async findPublicTeachers(query: {
    languageId?: string;
    online?: boolean;
    serviceType?: string;
  }) {
    const where: any = { applicationStatus: 'APPROVED' };

    if (query.online === true) {
      where.isOnline = true;
    }

    if (query.languageId || query.serviceType) {
      where.teacherLanguages = {
        some: {
          ...(query.languageId ? { languageId: query.languageId } : {}),
          ...(query.serviceType ? { serviceType: query.serviceType } : {}),
        },
      };
    }

    return this.prisma.teacherProfile.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        bio: true,
        profileTitle: true,
        profilePhotoUrl: true,
        experienceYears: true,
        isOnline: true,
        countryOfBirth: true,
        requestedHourlyRateDA: true,
        user: { select: { fullName: true } },
        teacherLanguages: {
          select: {
            id: true,
            serviceType: true,
            language: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: [{ isOnline: 'desc' }],
    });
  }

  async getPublicProfile(id: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true, createdAt: true } },
        teacherLanguages: {
          include: {
            language: true,
            certificates: {
              select: {
                id: true,
                description: true,
                issuedBy: true,
                yearFrom: true,
                yearTo: true,
                fileUrl: true,
              },
            },
          },
        },
        spokenLanguages: { include: { language: true } },
        educations: true,
      },
    });

    if (!teacher) throw new NotFoundException('Teacher not found');
    if (teacher.applicationStatus !== 'APPROVED') {
      throw new NotFoundException('Teacher profile not available');
    }

    const {
      idDocumentUrl,
      phoneNumber,
      reviewNote,
      reviewedBy,
      reviewedAt,
      userId,
      ...publicData
    } = teacher;

    return publicData;
  }

  async setOnline(userId: string, isOnline: boolean) {
    const profile = await this.prisma.teacherProfile.findUnique({ where: { userId } });
    if (!profile) throw new BadRequestException('Profile not found');
    if (profile.applicationStatus !== 'APPROVED') {
      throw new BadRequestException('Only approved teachers can change online status');
    }

    return this.prisma.teacherProfile.update({
      where: { userId },
      data: { isOnline },
      select: { id: true, isOnline: true },
    });
  }

  async getMyProfile(userId: string) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { email: true, fullName: true, createdAt: true } },
        teacherLanguages: { include: { language: true, certificates: true } },
        spokenLanguages: { include: { language: true } },
        educations: true,
      },
    });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async getDashboard(userId: string) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      select: { id: true, isOnline: true, applicationStatus: true },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const now = new Date();

    const startOfWeek = new Date(now);
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(now.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      totalCalls,
      weekCalls,
      monthCalls,
      totalSec,
      weekSec,
      monthSec,
      upcomingBookings,
      recentCalls,
    ] = await Promise.all([
      this.prisma.call.count({ where: { teacherId: profile.id, status: 'COMPLETED' } }),
      this.prisma.call.count({
        where: { teacherId: profile.id, status: 'COMPLETED', startTime: { gte: startOfWeek } },
      }),
      this.prisma.call.count({
        where: { teacherId: profile.id, status: 'COMPLETED', startTime: { gte: startOfMonth } },
      }),
      this.prisma.call.aggregate({
        where: { teacherId: profile.id, status: 'COMPLETED' },
        _sum: { durationSec: true },
      }),
      this.prisma.call.aggregate({
        where: { teacherId: profile.id, status: 'COMPLETED', startTime: { gte: startOfWeek } },
        _sum: { durationSec: true },
      }),
      this.prisma.call.aggregate({
        where: { teacherId: profile.id, status: 'COMPLETED', startTime: { gte: startOfMonth } },
        _sum: { durationSec: true },
      }),
      this.prisma.booking.findMany({
        where: {
          teacherId: profile.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          scheduledAt: { gte: now },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 5,
        include: { student: { include: { user: { select: { fullName: true } } } } },
      }),
      this.prisma.call.findMany({
        where: { teacherId: profile.id, status: 'COMPLETED' },
        orderBy: { startTime: 'desc' },
        take: 5,
        include: { student: { include: { user: { select: { fullName: true } } } } },
      }),
    ]);

    return {
       id: profile.id,
      isOnline: profile.isOnline,
      applicationStatus: profile.applicationStatus,
      stats: {
        totalCalls,
        weekCalls,
        monthCalls,
        totalTeachingSec: totalSec._sum.durationSec ?? 0,
        weekTeachingSec: weekSec._sum.durationSec ?? 0,
        monthTeachingSec: monthSec._sum.durationSec ?? 0,
      },
      upcomingBookings: upcomingBookings.map((b) => ({
        id: b.id,
        scheduledAt: b.scheduledAt,
        durationMin: b.durationMin,
        serviceType: b.serviceType,
        studentName: b.student.user.fullName,
        status: b.status,
      })),
      recentCalls: recentCalls.map((c) => ({
        id: c.id,
        startTime: c.startTime,
        durationSec: c.durationSec,
        serviceType: c.serviceType,
        studentName: c.student.user.fullName,
      })),
    };
  }

  async getTeachingTimeBreakdown(userId: string) {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Profile not found');

    const now = new Date();

    const startOfWeek = new Date(now);
    const dow = now.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    startOfWeek.setDate(now.getDate() + diffToMon);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const startOf30 = new Date(now);
    startOf30.setDate(now.getDate() - 29);
    startOf30.setHours(0, 0, 0, 0);

    const EARNED_TYPES = ['LESSON_COMPLETED'] as const;

    const [allTimeAgg, weekAgg, monthAgg, last30, ledgerEntries] = await Promise.all([
      this.prisma.teachingTimeLedger.aggregate({
        where: { teacherId: profile.id, type: { in: [...EARNED_TYPES] } },
        _sum: { seconds: true },
      }),
      this.prisma.teachingTimeLedger.aggregate({
        where: {
          teacherId: profile.id,
          type: { in: [...EARNED_TYPES] },
          createdAt: { gte: startOfWeek },
        },
        _sum: { seconds: true },
      }),
      this.prisma.teachingTimeLedger.aggregate({
        where: {
          teacherId: profile.id,
          type: { in: [...EARNED_TYPES] },
          createdAt: { gte: startOfMonth },
        },
        _sum: { seconds: true },
      }),
      this.prisma.teachingTimeLedger.findMany({
        where: {
          teacherId: profile.id,
          type: { in: [...EARNED_TYPES] },
          createdAt: { gte: startOf30 },
        },
        select: { seconds: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.teachingTimeLedger.findMany({
        where: { teacherId: profile.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    const buckets: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(startOf30);
      d.setDate(startOf30.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = 0;
    }
    for (const e of last30) {
      const key = new Date(e.createdAt).toISOString().slice(0, 10);
      if (key in buckets) buckets[key] += e.seconds;
    }

    const dailyList = Object.entries(buckets).map(([date, seconds]) => ({
      date,
      seconds,
    }));

    return {
      allTimeSec: allTimeAgg._sum.seconds ?? 0,
      weekSec: weekAgg._sum.seconds ?? 0,
      monthSec: monthAgg._sum.seconds ?? 0,
      dailyLast30: dailyList,
      ledger: ledgerEntries,
    };
  }
}