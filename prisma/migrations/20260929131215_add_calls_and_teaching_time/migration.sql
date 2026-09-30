-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TeachingTimeType" AS ENUM ('LESSON_COMPLETED', 'PAYMENT_REQUESTED', 'TIME_FROZEN', 'PAYMENT_COMPLETED', 'ADMIN_ADJUSTMENT');

-- CreateTable
CREATE TABLE "Call" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "agoraChannelId" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endTime" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "status" "CallStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Call_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingTimeLedger" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "type" "TeachingTimeType" NOT NULL,
    "seconds" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeachingTimeLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Call_studentId_status_idx" ON "Call"("studentId", "status");

-- CreateIndex
CREATE INDEX "Call_teacherId_status_idx" ON "Call"("teacherId", "status");

-- CreateIndex
CREATE INDEX "TeachingTimeLedger_teacherId_createdAt_idx" ON "TeachingTimeLedger"("teacherId", "createdAt");

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Call" ADD CONSTRAINT "Call_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingTimeLedger" ADD CONSTRAINT "TeachingTimeLedger_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
