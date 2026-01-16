/*
  Warnings:

  - You are about to drop the column `OperatorID` on the `ReturnMethod` table. All the data in the column will be lost.
  - You are about to drop the column `OperatorId` on the `TrackingTarget` table. All the data in the column will be lost.
  - You are about to drop the column `PatternId` on the `TrackingTarget` table. All the data in the column will be lost.
  - You are about to drop the `Pattern` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ReturnMethod" DROP CONSTRAINT "ReturnMethod_OperatorID_fkey";

-- DropForeignKey
ALTER TABLE "TrackingTarget" DROP CONSTRAINT "TrackingTarget_OperatorId_fkey";

-- DropForeignKey
ALTER TABLE "TrackingTarget" DROP CONSTRAINT "TrackingTarget_PatternId_fkey";

-- AlterTable
ALTER TABLE "ReturnMethod" DROP COLUMN "OperatorID";

-- AlterTable
ALTER TABLE "TrackingTarget" DROP COLUMN "OperatorId",
DROP COLUMN "PatternId";

-- DropTable
DROP TABLE "Pattern";
