/*
  Warnings:

  - You are about to drop the column `teacherId` on the `Certificate` table. All the data in the column will be lost.
  - Added the required column `teacherLanguageId` to the `Certificate` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Certificate" DROP CONSTRAINT "Certificate_teacherId_fkey";

-- AlterTable
ALTER TABLE "Certificate" DROP COLUMN "teacherId",
ADD COLUMN     "teacherLanguageId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Certificate" ADD CONSTRAINT "Certificate_teacherLanguageId_fkey" FOREIGN KEY ("teacherLanguageId") REFERENCES "TeacherLanguage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
