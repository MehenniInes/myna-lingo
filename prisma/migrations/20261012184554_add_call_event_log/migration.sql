-- CreateTable
CREATE TABLE "CallEventLog" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CallEventLog_callId_createdAt_idx" ON "CallEventLog"("callId", "createdAt");

-- AddForeignKey
ALTER TABLE "CallEventLog" ADD CONSTRAINT "CallEventLog_callId_fkey" FOREIGN KEY ("callId") REFERENCES "Call"("id") ON DELETE CASCADE ON UPDATE CASCADE;
