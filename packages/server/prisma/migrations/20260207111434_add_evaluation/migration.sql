/*
  Warnings:

  - You are about to drop the column `UserId` on the `Evaluation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Evaluation" DROP CONSTRAINT "Evaluation_UserId_fkey";

-- AlterTable
ALTER TABLE "Evaluation" DROP COLUMN "UserId";
