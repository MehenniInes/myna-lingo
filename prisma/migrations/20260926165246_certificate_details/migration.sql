-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "description" TEXT,
ADD COLUMN     "issuedBy" TEXT,
ADD COLUMN     "subject" TEXT,
ADD COLUMN     "yearsOfStudy" INTEGER;
