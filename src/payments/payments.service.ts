import {
  Injectable, BadRequestException, NotFoundException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly isMock =
    (process.env.PAYMENT_MOCK ?? 'true').toLowerCase() === 'true';

  constructor(private prisma: PrismaService) {}

  // ---------- CREATE CHECKOUT ----------

  async createPackageCheckout(userId: string, packageId: string) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
    });
    if (!pkg || !pkg.isActive) {
      throw new NotFoundException('Package not found or inactive');
    }

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

    // MOCK MODE — return a fake checkout URL. Do not call Chargily.
    if (this.isMock) {
      this.logger.warn(
        `[MOCK] Checkout created for payment ${payment.id} — no Chargily call made.`,
      );
      const fakeUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/mock?paymentId=${payment.id}`;
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          chargilyCheckoutId: `mock_${payment.id}`,
          chargilyCheckoutUrl: fakeUrl,
        },
      });
      return {
        paymentId: payment.id,
        checkoutUrl: fakeUrl,
        amountDA: pkg.priceDA,
        mock: true,
      };
    }

    // REAL MODE — call Chargily
    const apiUrl = process.env.CHARGILY_API_URL;
    const apiKey = process.env.CHARGILY_API_KEY;
    if (!apiUrl || !apiKey) {
      throw new BadRequestException('Chargily credentials are not configured');
    }

    const webhookUrl = `${process.env.BACKEND_URL || 'http://localhost:4000'}/payments/webhook/chargily`;

    const response = await fetch(`${apiUrl}/checkouts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: pkg.priceDA,
        currency: 'dzd',
        payment_method: 'edahabia', // or 'cib' / 'chargily_app'
        success_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`,
        failure_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/failure`,
        webhook_endpoint: webhookUrl,
        description: `Myna Lingo — ${pkg.minutes} minutes package`,
        locale: 'ar',
        metadata: [{ paymentId: payment.id }],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      this.logger.error('Chargily checkout failed', data);
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      throw new BadRequestException(
        data?.message || 'Could not create checkout session',
      );
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        chargilyCheckoutId: data.id,
        chargilyCheckoutUrl: data.checkout_url,
      },
    });

    return {
      paymentId: payment.id,
      checkoutUrl: data.checkout_url,
      amountDA: pkg.priceDA,
      mock: false,
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
    if (!this.verifyChargilySignature(rawBody, signature)) {
      this.logger.warn('Rejected webhook — invalid signature');
      throw new BadRequestException('Invalid signature');
    }

    const event = JSON.parse(rawBody.toString('utf8'));
    this.logger.log(`Received Chargily event: ${event.type}`);

    // Only care about paid checkouts
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

    // Idempotency — if already successful, do nothing
    if (payment.status === 'SUCCESS') {
      return { received: true, ignored: 'already_processed' };
    }

    // Mark success + add minutes
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

          // Fire a notification (uses the Notifications table)
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

    // Build a fake event payload exactly like Chargily would
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
}