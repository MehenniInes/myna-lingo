import { Injectable, ConflictException } from '@nestjs/common';
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
}