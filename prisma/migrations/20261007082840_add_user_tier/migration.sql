-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('TRIAL', 'NORMAL', 'PREMIUM', 'VIP');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NONE', 'PENDING_VERIFICATION', 'ACTIVE', 'REFUNDED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "tier" "UserTier" NOT NULL DEFAULT 'TRIAL';
