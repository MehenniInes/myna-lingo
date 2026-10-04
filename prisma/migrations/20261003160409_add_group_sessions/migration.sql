-- CreateEnum
CREATE TYPE "PresenceStatus" AS ENUM ('IN_CALL', 'DISCONNECTED_PENDING', 'LEFT');

-- CreateEnum
CREATE TYPE "GroupSessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "GroupSession" (
    "id" TEXT NOT NULL,
    "groupClassId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "agoraChannel" TEXT,
    "status" "GroupSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomPresence" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PresenceStatus" NOT NULL DEFAULT 'IN_CALL',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "RoomPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupSession_roomId_key" ON "GroupSession"("roomId");

-- CreateIndex
CREATE INDEX "GroupSession_groupClassId_status_idx" ON "GroupSession"("groupClassId", "status");

-- CreateIndex
CREATE INDEX "RoomPresence_userId_status_idx" ON "RoomPresence"("userId", "status");

-- CreateIndex
CREATE INDEX "RoomPresence_sessionId_status_idx" ON "RoomPresence"("sessionId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RoomPresence_sessionId_userId_key" ON "RoomPresence"("sessionId", "userId");

-- AddForeignKey
ALTER TABLE "GroupSession" ADD CONSTRAINT "GroupSession_groupClassId_fkey" FOREIGN KEY ("groupClassId") REFERENCES "GroupClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPresence" ADD CONSTRAINT "RoomPresence_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "GroupSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomPresence" ADD CONSTRAINT "RoomPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
