-- CreateTable
CREATE TABLE "TeacherVideo" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "sizeBytes" INTEGER,
    "mimeType" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherVideo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeacherVideo_teacherId_uploadedAt_idx" ON "TeacherVideo"("teacherId", "uploadedAt");

-- AddForeignKey
ALTER TABLE "TeacherVideo" ADD CONSTRAINT "TeacherVideo_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
