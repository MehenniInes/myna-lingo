-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('ICEBREAKER', 'VISUAL_EXPRESSION', 'DEBATE', 'SHADOWING', 'PERSONAL_TOPIC', 'SHORT_STORY', 'VOCABULARY_CHALLENGE');

-- CreateTable
CREATE TABLE "LearningActivity" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" JSONB NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 20,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityQuestion" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "answer" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "ActivityQuestion_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ActivityQuestion" ADD CONSTRAINT "ActivityQuestion_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "LearningActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
