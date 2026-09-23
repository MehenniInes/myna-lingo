-- CreateTable
CREATE TABLE "Podcast" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "coverUrl" TEXT NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "languageId" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "priceDA" INTEGER NOT NULL,
    "xpReward" INTEGER NOT NULL DEFAULT 50,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Podcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "priceDA" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PodcastPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "lastPositionSec" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PodcastProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastTranscript" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "startSec" INTEGER NOT NULL,
    "endSec" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "PodcastTranscript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastVocabulary" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "meaning" TEXT NOT NULL,
    "translation" TEXT NOT NULL,
    "example" TEXT NOT NULL,
    "pronunciation" TEXT,

    CONSTRAINT "PodcastVocabulary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PodcastQuestion" (
    "id" TEXT NOT NULL,
    "podcastId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "options" TEXT[],
    "correctIdx" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "PodcastQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PodcastPurchase_userId_podcastId_key" ON "PodcastPurchase"("userId", "podcastId");

-- CreateIndex
CREATE UNIQUE INDEX "PodcastProgress_userId_podcastId_key" ON "PodcastProgress"("userId", "podcastId");

-- AddForeignKey
ALTER TABLE "Podcast" ADD CONSTRAINT "Podcast_languageId_fkey" FOREIGN KEY ("languageId") REFERENCES "Language"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastPurchase" ADD CONSTRAINT "PodcastPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastPurchase" ADD CONSTRAINT "PodcastPurchase_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastProgress" ADD CONSTRAINT "PodcastProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastProgress" ADD CONSTRAINT "PodcastProgress_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastTranscript" ADD CONSTRAINT "PodcastTranscript_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastVocabulary" ADD CONSTRAINT "PodcastVocabulary_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PodcastQuestion" ADD CONSTRAINT "PodcastQuestion_podcastId_fkey" FOREIGN KEY ("podcastId") REFERENCES "Podcast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
