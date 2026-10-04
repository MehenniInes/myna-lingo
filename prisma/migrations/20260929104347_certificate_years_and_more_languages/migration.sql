/*
  Warnings:

  - You are about to drop the column `subject` on the `Certificate` table. All the data in the column will be lost.
  - You are about to drop the column `yearsOfStudy` on the `Certificate` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Certificate" DROP COLUMN "subject",
DROP COLUMN "yearsOfStudy",
ADD COLUMN     "yearFrom" INTEGER,
ADD COLUMN     "yearTo" INTEGER;

INSERT INTO "Language" (id, code, name, "isActive") VALUES
  ('lang-ar-001', 'ar', 'Arabic', true),
  ('lang-fr-001', 'fr', 'French', true),
  ('lang-de-001', 'de', 'German', true),
  ('lang-es-001', 'es', 'Spanish', true),
  ('lang-zh-001', 'zh', 'Chinese', true),
  ('lang-ko-001', 'ko', 'Korean', true),
  ('lang-ja-001', 'ja', 'Japanese', true),
  ('lang-ru-001', 'ru', 'Russian', true),
  ('lang-it-001', 'it', 'Italian', true),
  ('lang-tr-001', 'tr', 'Turkish', true),
  ('lang-hi-001', 'hi', 'Hindi', true),
  ('lang-ur-001', 'ur', 'Urdu', true),
  ('lang-vi-001', 'vi', 'Vietnamese', true),
  ('lang-fil-001', 'fil', 'Filipino', true)
ON CONFLICT DO NOTHING;
