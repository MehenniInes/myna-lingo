-- CreateEnum
CREATE TYPE "CheckoutStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentProduct" AS ENUM ('PACKAGE', 'PODCAST');

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productType" "PaymentProduct" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceLabel" TEXT,
    "amountDA" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'dzd',
    "status" "CheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "chargilyCheckoutId" TEXT,
    "chargilyCheckoutUrl" TEXT,
    "chargilyWebhookPayload" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_chargilyCheckoutId_key" ON "Payment"("chargilyCheckoutId");

-- CreateIndex
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");

-- CreateIndex
CREATE INDEX "Payment_chargilyCheckoutId_idx" ON "Payment"("chargilyCheckoutId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
