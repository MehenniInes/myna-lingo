import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminService {
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
  async getAllUsers(role?: string) {
    return this.prisma.user.findMany({
      where: role ? { role: role as any } : {},
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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
}