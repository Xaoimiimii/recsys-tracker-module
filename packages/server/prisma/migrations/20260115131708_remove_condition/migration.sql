/*
  Warnings:

  - You are about to drop the `Condition` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Condition" DROP CONSTRAINT "Condition_OperatorID_fkey";

-- DropForeignKey
ALTER TABLE "Condition" DROP CONSTRAINT "Condition_PatternId_fkey";

-- DropForeignKey
ALTER TABLE "Condition" DROP CONSTRAINT "Condition_TrackingRuleID_fkey";

-- DropTable
DROP TABLE "Condition";
