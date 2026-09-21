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
        applicationStatus: 'PENDING_REVIEW',
        teacherLanguages: {
          create: dto.languages.map((l) => ({
            languageId: l.languageId,
            serviceType: l.serviceType,
          })),
        },
        certificates: {
          create: dto.certificateUrls.map((url) => ({ fileUrl: url })),
        },
      },
      update: {
        bio: dto.bio,
        experienceYears: dto.experienceYears,
        introVideoUrl: dto.introVideoUrl,
        profilePhotoUrl: dto.profilePhotoUrl,
        applicationStatus: 'PENDING_REVIEW',
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: null,
      },
      include: { teacherLanguages: true, certificates: true },
    });

    return teacherProfile;
  }
}