-- AlterTable
ALTER TABLE "Podcast" ADD COLUMN     "videoUrl" TEXT,
ALTER COLUMN "coverUrl" SET DEFAULT '',
ALTER COLUMN "audioUrl" SET DEFAULT '';
