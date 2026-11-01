/*
  Warnings:

  - You are about to drop the column `headers` on the `WebhookLog` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "WebhookLog" DROP COLUMN "headers";

-- CreateIndex
CREATE INDEX "WebhookLog_eventType_idx" ON "WebhookLog"("eventType");
