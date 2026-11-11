import {
  Injectable, BadRequestException, NotFoundException, Logger, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SlickPayService } from './slickpay.service.js';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly isMock =
    (process.env.PAYMENT_MOCK ?? 'true').toLowerCase() === 'true';

  constructor(
    private prisma: PrismaService,
    private readonly slickPayService: SlickPayService,
  ) {}

  // ---------- CREATE CHECKOUT ----------

  async createPackageCheckout(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
    });
    if (!pkg || !pkg.isActive) {
      throw new NotFoundException('Package not found or inactive');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        productType: 'PACKAGE',
        referenceId: pkg.id,
        referenceLabel: `${pkg.minutes} minutes package`,
        amountDA: pkg.priceDA,
        status: 'PENDING',
      },
    });

       const [firstName, ...rest] = (user.fullName || 'Myna User').split(' ');
    const lastName = rest.join(' ') || 'User';

    const invoiceResponse = await this.slickPayService.createInvoice({
      amount: pkg.priceDA,
      firstName,
      lastName,
      email: user.email,
      phone: user.phone ?? undefined,
      address: 'Algeria',
      url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`,
      items: [
        {
          name: `${pkg.minutes} minutes package`,
          price: pkg.priceDA,
          quantity: 1,
        },
      ],
    });

    // 👈 نطبعو الاستجابة كاملة فـ Terminal تاع الباكند باش نشوفوها
    this.logger.log(`SlickPay Full Response: ${JSON.stringify(invoiceResponse)}`);

    // 👈 نقلبو على الرابط والـ ID فـ كل الاحتمالات
    const checkoutUrl = 
      invoiceResponse.url || 
      invoiceResponse.data?.url || 
      invoiceResponse.invoice?.url || 
      invoiceResponse.data?.invoice?.url;

    const invoiceId = 
      invoiceResponse.id || 
      invoiceResponse.data?.id || 
      invoiceResponse.invoice?.id || 
      invoiceResponse.data?.invoice?.id || 
      `slick_${Date.now()}`;

    if (!checkoutUrl) {
      throw new BadRequestException('SlickPay did not return a checkout URL.');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        slickpayInvoiceId: String(invoiceId),
        slickpayCheckoutUrl: checkoutUrl,
      } as any,
    });

    return {
      paymentId: payment.id,
      checkoutUrl: checkoutUrl,
      amountDA: pkg.priceDA,
      provider: 'slickpay',
    };
  }

  // ---------- WEBHOOK SIGNATURE VERIFICATION ----------

  private verifyChargilySignature(rawBody: Buffer, signatureHeader: string): boolean {
    const secret = process.env.CHARGILY_WEBHOOK_SECRET;
    if (!secret) {
      this.logger.error('CHARGILY_WEBHOOK_SECRET not configured');
      return false;
    }
    const computed = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(signatureHeader || '', 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  }

  // ---------- WEBHOOK HANDLER ----------

  async handleChargilyWebhook(rawBody: Buffer, signature: string) {
    let parsedEventType: string | null = null;
    try {
      const parsed = JSON.parse(rawBody.toString('utf8'));
      parsedEventType = parsed?.type ?? null;
    } catch { /* not valid JSON — still log */ }

    try {
      await this.prisma.webhookLog.create({
        data: {
          source: 'chargily',
          eventType: parsedEventType,
          signature: signature ?? null,
          rawBody: rawBody.toString('utf8'),
        },
      });
    } catch (logErr: any) {
      this.logger.warn(`WebhookLog write failed: ${logErr.message}`);
    }

    if (!this.verifyChargilySignature(rawBody, signature)) {
      this.logger.warn('Rejected webhook — invalid signature');
      throw new BadRequestException('Invalid signature');
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    this.logger.log(`Received Chargily event: ${event.type}`);

    if (event.type !== 'checkout.paid') {
      return { received: true, ignored: event.type };
    }

    const checkout = event.data;
    const paymentId = checkout.metadata?.[0]?.paymentId;
    if (!paymentId) {
      this.logger.warn('checkout.paid without paymentId in metadata');
      return { received: true, ignored: 'no_payment_id' };
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      this.logger.warn(`Payment ${paymentId} not found`);
      return { received: true, ignored: 'payment_not_found' };
    }

    if (payment.status === 'SUCCESS') {
      return { received: true, ignored: 'already_processed' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(),
          chargilyWebhookPayload: event,
        },
      });

      if (payment.productType === 'PACKAGE') {
        const pkg = await tx.package.findUnique({
          where: { id: payment.referenceId },
        });
        const student = await tx.studentProfile.findUnique({
          where: { userId: payment.userId },
        });
        if (pkg && student) {
          const lastEntry = await tx.minuteLedgerEntry.findFirst({
            where: { studentId: student.id },
            orderBy: { createdAt: 'desc' },
          });
          const currentBalance = lastEntry?.balanceAfter ?? 0;
          const secondsToAdd = pkg.minutes * 60;

          await tx.minuteLedgerEntry.create({
            data: {
              studentId: student.id,
              type: 'PACKAGE_PURCHASE',
              seconds: secondsToAdd,
              balanceAfter: currentBalance + secondsToAdd,
              referenceId: payment.id,
              note: `Chargily payment ${payment.id} — ${pkg.minutes} min`,
            },
          });

          await tx.notification.create({
            data: {
              userId: payment.userId,
              type: 'PAYMENT_SUCCESS',
              title: 'Payment successful',
              message: `You added ${pkg.minutes} minutes to your account.`,
              data: { paymentId: payment.id },
            },
          });
        }
      }
    });

    this.logger.log(`Payment ${payment.id} completed — minutes added.`);
    return { received: true };
  }

  // ---------- MOCK HELPERS (development only) ----------

  async simulateMockPayment(paymentId: string) {
    if (!this.isMock) {
      throw new BadRequestException('Mock mode is disabled');
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    const fakeEvent = {
      type: 'checkout.paid',
      data: {
        id: payment.chargilyCheckoutId,
        status: 'paid',
        amount: payment.amountDA,
        currency: 'dzd',
        metadata: [{ paymentId: payment.id }],
      },
    };

    const rawBody = Buffer.from(JSON.stringify(fakeEvent));
    const secret = process.env.CHARGILY_WEBHOOK_SECRET || 'mock_secret';
    const signature = createHmac('sha256', secret).update(rawBody).digest('hex');

    return this.handleChargilyWebhook(rawBody, signature);
  }

  async listMyPayments(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getPaymentStatus(userId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        id: true,
        userId: true,
        status: true,
        amountDA: true,
        currency: true,
        productType: true,
        referenceLabel: true,
        chargilyCheckoutId: true,
        paidAt: true,
        createdAt: true,
      },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.userId !== userId) {
      throw new ForbiddenException('Not your payment');
    }
    return payment;
  }

  // ---------- Admin overrides ----------

  async adminListPayments(status?: string) {
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;

    return this.prisma.payment.findMany({
      where,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
  }

  async adminActivate(paymentId: string, adminUserId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === 'SUCCESS') {
      throw new BadRequestException('Already successful');
    }
    if (payment.status === 'REFUNDED') {
      throw new BadRequestException('Payment was refunded');
    }
    if (payment.productType !== 'PACKAGE') {
      throw new BadRequestException('Only package payments can be activated');
    }

    const pkg = await this.prisma.package.findUnique({
      where: { id: payment.referenceId },
    });
    if (!pkg) throw new NotFoundException('Package no longer exists');

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: payment.userId },
    });
    if (!student) throw new BadRequestException('Student profile not found');

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.minuteLedgerEntry.findFirst({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
      });
      const currentBalance = last?.balanceAfter ?? 0;
      const secondsToAdd = pkg.minutes * 60;

      await tx.minuteLedgerEntry.create({
        data: {
          studentId: student.id,
          type: 'PACKAGE_PURCHASE',
          seconds: secondsToAdd,
          balanceAfter: currentBalance + secondsToAdd,
          referenceId: payment.id,
          note: `Manual activation by admin ${adminUserId}`,
        },
      });

      await tx.notification.create({
        data: {
          userId: payment.userId,
          type: 'PAYMENT_SUCCESS',
          title: 'Payment activated',
          message: `${pkg.minutes} minutes added to your account (manual activation).`,
          data: { paymentId: payment.id, manual: true },
        },
      });

      return tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(),
          chargilyWebhookPayload: {
            ...(typeof payment.chargilyWebhookPayload === 'object' ? payment.chargilyWebhookPayload : {}),
            manualActivationBy: adminUserId,
            manualActivatedAt: new Date().toISOString(),
          },
        },
      });
    });
  }

  async adminRefund(paymentId: string, adminUserId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'SUCCESS') {
      throw new BadRequestException('Only SUCCESS payments can be refunded');
    }
    if (payment.productType !== 'PACKAGE') {
      throw new BadRequestException('Only package payments can be refunded');
    }

    const pkg = await this.prisma.package.findUnique({
      where: { id: payment.referenceId },
    });
    if (!pkg) throw new NotFoundException('Package no longer exists');

    const student = await this.prisma.studentProfile.findUnique({
      where: { userId: payment.userId },
    });
    if (!student) throw new BadRequestException('Student profile not found');

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.minuteLedgerEntry.findFirst({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
      });
      const currentBalance = last?.balanceAfter ?? 0;
      const refundableSeconds = Math.min(pkg.minutes * 60, currentBalance);

      if (refundableSeconds > 0) {
        await tx.minuteLedgerEntry.create({
          data: {
            studentId: student.id,
            type: 'REFUND',
            seconds: -refundableSeconds,
            balanceAfter: currentBalance - refundableSeconds,
            referenceId: payment.id,
            note: `Refund by admin ${adminUserId} — ${Math.floor(refundableSeconds / 60)} min deducted`,
          },
        });
      }

      await tx.notification.create({
        data: {
          userId: payment.userId,
          type: 'PAYMENT_SUCCESS',
          title: 'Payment refunded',
          message: `Your payment has been refunded. ${Math.floor(refundableSeconds / 60)} minutes deducted from your balance.`,
          data: { paymentId: payment.id, refundedSeconds: refundableSeconds },
        },
      });

      return tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'REFUNDED',
          chargilyWebhookPayload: {
            ...(typeof payment.chargilyWebhookPayload === 'object' ? payment.chargilyWebhookPayload : {}),
            refundedBy: adminUserId,
            refundedAt: new Date().toISOString(),
            refundedSeconds: refundableSeconds,
          },
        },
      });
    });
  }

  // ---------- SlickPay Webhook ----------
  async handleSlickPayWebhook(event: any) {
    this.logger.log(`SlickPay webhook received: ${JSON.stringify(event)}`);

    const invoiceId = String(event?.invoice?.id ?? event?.id ?? '');
    if (!invoiceId) {
      this.logger.warn('SlickPay webhook without invoice id');
      return { received: true, ignored: 'no_invoice_id' };
    }

    const payment = await this.prisma.payment.findFirst({
      where: { slickpayInvoiceId: invoiceId } as any,
    });
    if (!payment) {
      this.logger.warn(`Payment not found for SlickPay invoice ${invoiceId}`);
      return { received: true, ignored: 'payment_not_found' };
    }

    if (payment.status === 'SUCCESS') {
      return { received: true, ignored: 'already_processed' };
    }

    const isPaid = event?.invoice?.status === 'paid' || event?.status === 'paid';
    if (!isPaid) {
      this.logger.log(`SlickPay invoice ${invoiceId} not paid yet: ${event?.invoice?.status}`);
      return { received: true, ignored: 'not_paid' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(),
          slickpayWebhookPayload: event,
        },
      });

      if (payment.productType === 'PACKAGE') {
        const pkg = await tx.package.findUnique({
          where: { id: payment.referenceId },
        });
        const student = await tx.studentProfile.findUnique({
          where: { userId: payment.userId },
        });
        if (pkg && student) {
          const lastEntry = await tx.minuteLedgerEntry.findFirst({
            where: { studentId: student.id },
            orderBy: { createdAt: 'desc' },
          });
          const currentBalance = lastEntry?.balanceAfter ?? 0;
          const secondsToAdd = pkg.minutes * 60;

          await tx.minuteLedgerEntry.create({
            data: {
              studentId: student.id,
              type: 'PACKAGE_PURCHASE',
              seconds: secondsToAdd,
              balanceAfter: currentBalance + secondsToAdd,
              referenceId: payment.id,
              note: `SlickPay payment ${payment.id} — ${pkg.minutes} min`,
            },
          });

          await tx.notification.create({
            data: {
              userId: payment.userId,
              type: 'PAYMENT_SUCCESS',
              title: 'Payment successful',
              message: `You added ${pkg.minutes} minutes to your account.`,
              data: { paymentId: payment.id },
            },
          });
        }
      }
    });

    this.logger.log(`SlickPay payment ${payment.id} completed — minutes added.`);
    return { received: true };
  }
}