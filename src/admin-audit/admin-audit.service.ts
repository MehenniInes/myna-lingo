import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminAuditService {
  private readonly logger = new Logger(AdminAuditService.name);

  constructor(private prisma: PrismaService) {}

  async logFromRequest(
    req: any,
    action: string,
    targetType: string,
    targetId: string | null,
    metadata?: any,
  ): Promise<void> {
    try {
      const adminUserId = req?.user?.userId ?? req?.user?.sub;
      const adminEmail = req?.user?.email ?? null;
      const ipAddress =
        (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req?.ip ||
        null;

      if (!adminUserId) {
        this.logger.warn(`Audit log skipped: no adminUserId for action ${action}`);
        return;
      }

      await this.prisma.adminAuditLog.create({
        data: {
          adminUserId,
          adminEmail,
          action,
          targetType,
          targetId,
          metadata: metadata ?? undefined,
          ipAddress,
        },
      });
    } catch (err: any) {
      this.logger.warn(`AdminAuditLog write failed: ${err.message}`);
    }
  }

  async list(params: { action?: string; targetType?: string; limit?: number }) {
    const where: any = {};
    if (params.action) where.action = params.action;
    if (params.targetType) where.targetType = params.targetType;

    const take = Math.min(Math.max(params.limit ?? 200, 1), 1000);

    return this.prisma.adminAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}