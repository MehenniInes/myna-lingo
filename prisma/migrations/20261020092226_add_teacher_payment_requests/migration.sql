-- CreateEnum
CREATE TYPE "TeacherPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "TeacherPaymentRequest" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "frozenSeconds" INTEGER NOT NULL,
    "payoutDA" INTEGER,
    "status" "TeacherPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherPaymentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherPaymentRequest_teacherId_status_idx" ON "TeacherPaymentRequest"("teacherId", "status");

-- CreateIndex
CREATE INDEX "TeacherPaymentRequest_status_requestedAt_idx" ON "TeacherPaymentRequest"("status", "requestedAt");

-- AddForeignKey
ALTER TABLE "TeacherPaymentRequest" ADD CONSTRAINT "TeacherPaymentRequest_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
