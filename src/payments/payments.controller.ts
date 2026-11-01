import {
  Controller, Post, Get, Req, Body, UseGuards,Param,Query,BadRequestException, Headers,} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentsService } from './payments.service.js';
import { CreatePackageCheckoutDto } from './dto/create-checkout.dto.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolesGuard } from '../auth/roles.guard.js';

@Controller('payments')
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  // ---------- STUDENT-FACING ----------

  @Post('checkout/package')
  @UseGuards(AuthGuard('jwt'))
  createPackageCheckout(@Req() req: any, @Body() dto: CreatePackageCheckoutDto) {
    return this.paymentsService.createPackageCheckout(req.user.userId, dto.packageId);
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  listMy(@Req() req: any) {
    return this.paymentsService.listMyPayments(req.user.userId);
  }

  // ---------- WEBHOOK (called by Chargily, no JWT) ----------

  @Post('webhook/chargily')
  async chargilyWebhook(
    @Req() req: any,
    @Headers('signature') signature: string,
  ) {
    // rawBody is populated because we passed rawBody: true in main.ts
    const rawBody: Buffer = req.rawBody;
    if (!rawBody) {
      throw new BadRequestException('Raw body missing — check main.ts');
    }
    return this.paymentsService.handleChargilyWebhook(rawBody, signature);
  }

  // ---------- MOCK (dev only) ----------

  @Post('mock/complete')
  async mockComplete(@Body() body: { paymentId: string }) {
    return this.paymentsService.simulateMockPayment(body.paymentId);
  }
    // ---------- Admin overrides ----------

  @Get('admin/all')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  adminList(@Query('status') status?: string) {
    return this.paymentsService.adminListPayments(status);
  }

  @Post('admin/:id/activate')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  adminActivate(@Req() req: any, @Param('id') id: string) {
    return this.paymentsService.adminActivate(id, req.user.userId);
  }

  @Post('admin/:id/refund')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMIN')
  adminRefund(@Req() req: any, @Param('id') id: string) {
    return this.paymentsService.adminRefund(id, req.user.userId);
  }
    @Get(':id/status')
  @UseGuards(AuthGuard('jwt'))
  async getStatus(@Req() req: any, @Param('id') id: string) {
    return this.paymentsService.getPaymentStatus(req.user.userId, id);
  }
}