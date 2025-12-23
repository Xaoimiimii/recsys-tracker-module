/*
  Warnings:

  - Added the required column `TrackingRuleId` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "TrackingRuleId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_TrackingRuleId_fkey" FOREIGN KEY ("TrackingRuleId") REFERENCES "TrackingRule"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
