/*
  Warnings:

  - You are about to drop the column `endYear` on the `Education` table. All the data in the column will be lost.
  - You are about to drop the column `fieldOfStudy` on the `Education` table. All the data in the column will be lost.
  - You are about to drop the column `institution` on the `Education` table. All the data in the column will be lost.
  - You are about to drop the column `startYear` on the `Education` table. All the data in the column will be lost.
  - Added the required column `university` to the `Education` table without a default value. This is not possible if the table is not empty.
  - Added the required column `yearFrom` to the `Education` table without a default value. This is not possible if the table is not empty.
  - Added the required column `yearTo` to the `Education` table without a default value. This is not possible if the table is not empty.
  - Made the column `degree` on table `Education` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Education" DROP COLUMN "endYear",
DROP COLUMN "fieldOfStudy",
DROP COLUMN "institution",
DROP COLUMN "startYear",
ADD COLUMN     "degreeType" TEXT,
ADD COLUMN     "diplomaUrl" TEXT,
ADD COLUMN     "specialization" TEXT,
ADD COLUMN     "university" TEXT NOT NULL,
ADD COLUMN     "yearFrom" INTEGER NOT NULL,
ADD COLUMN     "yearTo" INTEGER NOT NULL,
ALTER COLUMN "degree" SET NOT NULL;
