/*
  Warnings:

  - You are about to drop the column `TrackingTargetId` on the `TrackingRule` table. All the data in the column will be lost.
  - You are about to drop the `TrackingTarget` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "TrackingRule" DROP CONSTRAINT "TrackingRule_TrackingTargetId_fkey";

-- AlterTable
ALTER TABLE "TrackingRule" DROP COLUMN "TrackingTargetId",
ADD COLUMN     "TrackingTarget" TEXT;

-- DropTable
DROP TABLE "TrackingTarget";
