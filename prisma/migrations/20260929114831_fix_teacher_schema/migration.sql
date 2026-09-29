/*
  Warnings:

  - You are about to drop the column `degreeType` on the `Education` table. All the data in the column will be lost.
  - You are about to drop the column `diplomaUrl` on the `Education` table. All the data in the column will be lost.
  - You are about to drop the column `specialization` on the `Education` table. All the data in the column will be lost.
  - You are about to drop the column `university` on the `Education` table. All the data in the column will be lost.
  - You are about to drop the column `yearFrom` on the `Education` table. All the data in the column will be lost.
  - You are about to drop the column `yearTo` on the `Education` table. All the data in the column will be lost.
  - Changed the type of `level` on the `SpokenLanguage` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropIndex
DROP INDEX "SpokenLanguage_teacherId_languageId_key";

-- AlterTable
ALTER TABLE "Education" DROP COLUMN "degreeType",
DROP COLUMN "diplomaUrl",
DROP COLUMN "specialization",
DROP COLUMN "university",
DROP COLUMN "yearFrom",
DROP COLUMN "yearTo",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "endYear" INTEGER,
ADD COLUMN     "fieldOfStudy" TEXT,
ADD COLUMN     "institution" TEXT,
ADD COLUMN     "startYear" INTEGER,
ALTER COLUMN "degree" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SpokenLanguage" DROP COLUMN "level",
ADD COLUMN     "level" TEXT NOT NULL;
