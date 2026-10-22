import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminAuditService } from './admin-audit.service.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Controller('admin/audit')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('ADMIN')
export class AdminAuditController {
  constructor(private service: AdminAuditService) {}

  @Get()
  list(
    @Query('action') action?: string,
    @Query('targetType') targetType?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : undefined;
    return this.service.list({
      action,
      targetType,
      limit: Number.isFinite(parsed) ? parsed : undefined,
    });
  }
}