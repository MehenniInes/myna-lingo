import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminService {
    async getPendingStudents() {
    return this.prisma.user.findMany({
      where: {
        role: 'STUDENT',
        paymentStatus: 'PENDING_VERIFICATION',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        tier: true,
        paymentStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  constructor(private prisma: PrismaService) {}

  // ===== PACKAGES =====
  async getAllPackages() {
    return this.prisma.package.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createPackage(data: { priceDA: number; minutes: number; sortOrder?: number; isActive?: boolean }) {
    return this.prisma.package.create({ data });
  }

  async updatePackage(id: string, data: { priceDA?: number; minutes?: number; sortOrder?: number; isActive?: boolean }) {
    const pkg = await this.prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    return this.prisma.package.update({ where: { id }, data });
  }

  async deletePackage(id: string) {
    const pkg = await this.prisma.package.findUnique({ where: { id } });
    if (!pkg) throw new NotFoundException('Package not found');
    return this.prisma.package.update({ where: { id }, data: { isActive: false } });
  }

  // ===== STATS =====
  async getStats() {
    const [students, parents, teachers, packages, podcasts] = await Promise.all([
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'PARENT' } }),
      this.prisma.user.count({ where: { role: 'TEACHER' } }),
      this.prisma.package.count({ where: { isActive: true } }),
      this.prisma.podcast.count({ where: { isActive: true } }),
    ]);
    return { students, parents, teachers, packages, podcasts };
  }

    // ===== PODCASTS =====
  async getAllPodcasts() {
    return this.prisma.podcast.findMany({
      include: { language: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPodcast(data: any) {
    return this.prisma.podcast.create({ data });
  }

  async updatePodcast(id: string, data: any) {
    const pod = await this.prisma.podcast.findUnique({ where: { id } });
    if (!pod) throw new NotFoundException('Podcast not found');
    return this.prisma.podcast.update({ where: { id }, data });
  }

  async deletePodcast(id: string) {
    const pod = await this.prisma.podcast.findUnique({ where: { id } });
    if (!pod) throw new NotFoundException('Podcast not found');
    return this.prisma.podcast.update({ where: { id }, data: { isActive: false } });
  }

    // ===== USERS =====
    async getAllUsers(role?: string, filter?: string) {
    const where: any = {};
    if (role) where.role = role as any;
    if (filter === 'pending') {
      where.paymentStatus = 'PENDING_VERIFICATION';
    }
    return this.prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        tier: true,              // ← new
        paymentStatus: true,     // ← new
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateUserTier(id: string, tier: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { tier: tier as any },
    });
  }

  async updateUserPaymentStatus(id: string, paymentStatus: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { paymentStatus: paymentStatus as any },
    });
  }

  async bulkActivatePending() {
    const result = await this.prisma.user.updateMany({
      where: { paymentStatus: 'PENDING_VERIFICATION' },
      data: { paymentStatus: 'ACTIVE' },
    });
    return { activatedCount: result.count };
  }

  async toggleUserActive(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });
  }
    // ===== ANALYTICS =====
  async getAnalytics() {
    const [
      totalUsers,
      totalStudents,
      totalParents,
      totalTeachers,
      activeTeachers,
      totalPackagesSold,
      totalPodcastsSold,
      totalXP,
      recentPurchases,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({ where: { role: 'PARENT' } }),
      this.prisma.user.count({ where: { role: 'TEACHER' } }),
      this.prisma.teacherProfile.count({ where: { isOnline: true } }),
      this.prisma.packagePurchase.count(),
      this.prisma.podcastPurchase.count(),
      this.prisma.xPTransaction.aggregate({ _sum: { amount: true } }),
      this.prisma.packagePurchase.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          student: { include: { user: { select: { fullName: true, email: true } } } },
          package: { select: { minutes: true, priceDA: true } },
        },
      }),
    ]);

    // Revenue
    const [pkgRevenue, podRevenue] = await Promise.all([
      this.prisma.packagePurchase.findMany({ include: { package: { select: { priceDA: true } } } }),
      this.prisma.podcastPurchase.findMany({ select: { priceDA: true } }),
    ]);

    const totalPackageRevenue = pkgRevenue.reduce((s, p) => s + p.package.priceDA, 0);
    const totalPodcastRevenue = podRevenue.reduce((s, p) => s + p.priceDA, 0);

    // Top packages (by purchase count)
    const topPackages = await this.prisma.package.findMany({
      include: { _count: { select: { purchases: true } } },
      orderBy: { purchases: { _count: 'desc' } },
      take: 5,
    });

    return {
      users: {
        total: totalUsers,
        students: totalStudents,
        parents: totalParents,
        teachers: totalTeachers,
        activeTeachers,
      },
      purchases: {
        packagesSold: totalPackagesSold,
        podcastsSold: totalPodcastsSold,
      },
      revenue: {
        packages: totalPackageRevenue,
        podcasts: totalPodcastRevenue,
        total: totalPackageRevenue + totalPodcastRevenue,
      },
      xp: {
        totalAwarded: totalXP._sum.amount ?? 0,
      },
      topPackages: topPackages.map((p) => ({
        minutes: p.minutes,
        priceDA: p.priceDA,
        sales: p._count.purchases,
      })),
      recentPurchases: recentPurchases.map((p) => ({
        id: p.id,
        student: p.student.user.fullName,
        minutes: p.package.minutes,
        priceDA: p.package.priceDA,
        createdAt: p.createdAt,
      })),
    };
  }

    // ===== ACTIVITIES =====
  async getAllActivities() {
    return this.prisma.learningActivity.findMany({
      include: { questions: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createActivity(data: any) {
    return this.prisma.learningActivity.create({ data });
  }

  async updateActivity(id: string, data: any) {
    const a = await this.prisma.learningActivity.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Activity not found');
    return this.prisma.learningActivity.update({ where: { id }, data });
  }

  async deleteActivity(id: string) {
    const a = await this.prisma.learningActivity.findUnique({ where: { id } });
    if (!a) throw new NotFoundException('Activity not found');
    return this.prisma.learningActivity.update({ where: { id }, data: { isActive: false } });
  }
     async listTeachers(params: { search?: string; status?: string }) {
    const where: any = {};

    if (params.status && params.status !== 'ALL') {
      where.applicationStatus = params.status;
    }

    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { user: { fullName: { contains: params.search, mode: 'insensitive' } } },
        { user: { email: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    return this.prisma.teacherProfile.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        countryOfBirth: true,
        profilePhotoUrl: true,
        isOnline: true,
        experienceYears: true,
        applicationStatus: true,
        requestedHourlyRateDA: true,
        user: {
          select: {
            email: true,
            fullName: true,
            isActive: true,
            createdAt: true,
          },
        },
        _count: { select: { teacherLanguages: true, calls: true } },
      },
      orderBy: { user: { createdAt: 'desc' } },
      take: 500,
    });
  }

  async suspendTeacher(teacherId: string, adminUserId: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    return this.prisma.teacherProfile.update({
      where: { id: teacherId },
      data: {
        applicationStatus: 'SUSPENDED',
        isOnline: false,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        reviewNote: 'Suspended by admin',
      },
    });
  }

  async reactivateTeacher(teacherId: string, adminUserId: string) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    return this.prisma.teacherProfile.update({
      where: { id: teacherId },
      data: {
        applicationStatus: 'APPROVED',
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        reviewNote: 'Reactivated by admin',
      },
    });
  }
    async listPricingRules() {
    return this.prisma.pricingRule.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async updatePricingRule(
    id: string,
    adminUserId: string,
    data: { label?: string; pricePerMinuteDA?: number; isActive?: boolean },
  ) {
    const rule = await this.prisma.pricingRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('Pricing rule not found');

    return this.prisma.pricingRule.update({
      where: { id },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.pricePerMinuteDA !== undefined
          ? { pricePerMinuteDA: data.pricePerMinuteDA }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        updatedBy: adminUserId,
      },
    });
  }
    async listTeacherRates() {
    return this.prisma.teacherProfile.findMany({
      where: { applicationStatus: 'APPROVED' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profilePhotoUrl: true,
        requestedHourlyRateDA: true,
        internalHourlyRateDA: true,
        user: { select: { email: true, fullName: true } },
        _count: { select: { calls: true } },
      },
      orderBy: [{ internalHourlyRateDA: 'asc' }, { firstName: 'asc' }],
      take: 500,
    });
  }

  async setTeacherRate(
    teacherId: string,
    internalHourlyRateDA: number | null,
  ) {
    const teacher = await this.prisma.teacherProfile.findUnique({
      where: { id: teacherId },
    });
    if (!teacher) throw new NotFoundException('Teacher not found');

    if (internalHourlyRateDA !== null) {
      if (!Number.isFinite(internalHourlyRateDA) || internalHourlyRateDA < 0) {
        throw new BadRequestException('Invalid rate');
      }
    }

    return this.prisma.teacherProfile.update({
      where: { id: teacherId },
      data: { internalHourlyRateDA },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        internalHourlyRateDA: true,
      },
    });
  }
      async listCalls(params: { status?: string; limit?: number }) {
    const where: any = {};
    if (params.status && params.status !== 'ALL') {
      where.status = params.status;
    }

    const take = Math.min(Math.max(params.limit ?? 100, 1), 500);

    return this.prisma.call.findMany({
      where,
      select: {
        id: true,
        startTime: true,
        endTime: true,
        durationSec: true,
        status: true,
        serviceType: true,
        agoraChannelId: true,
        student: {
          select: {
            id: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        teacher: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: { select: { fullName: true, email: true } },
          },
        },
      },
      orderBy: { startTime: 'desc' },
      take,
    });
  }

  async getCallStats() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    const dow = now.getDay();
    startOfWeek.setDate(now.getDate() + (dow === 0 ? -6 : 1 - dow));
    startOfWeek.setHours(0, 0, 0, 0);

    const [activeCount, todayAgg, weekAgg, totalAgg] = await Promise.all([
      this.prisma.call.count({ where: { status: 'ACTIVE' } }),
      this.prisma.call.aggregate({
        where: { status: 'COMPLETED', startTime: { gte: startOfDay } },
        _sum: { durationSec: true },
        _count: true,
      }),
      this.prisma.call.aggregate({
        where: { status: 'COMPLETED', startTime: { gte: startOfWeek } },
        _sum: { durationSec: true },
        _count: true,
      }),
      this.prisma.call.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { durationSec: true },
        _count: true,
      }),
    ]);

    return {
      activeCalls: activeCount,
      today: {
        calls: todayAgg._count,
        seconds: todayAgg._sum.durationSec ?? 0,
      },
      week: {
        calls: weekAgg._count,
        seconds: weekAgg._sum.durationSec ?? 0,
      },
      total: {
        calls: totalAgg._count,
        seconds: totalAgg._sum.durationSec ?? 0,
      },
    };
  }
}