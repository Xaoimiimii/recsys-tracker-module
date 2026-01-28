/*
  Warnings:

  - You are about to drop the column `SearchKeywordConfigID` on the `ReturnMethod` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "PayloadMappingSource" ADD VALUE 'page_url';

-- DropForeignKey
ALTER TABLE "ReturnMethod" DROP CONSTRAINT "ReturnMethod_SearchKeywordConfigID_fkey";

-- AlterTable
ALTER TABLE "ReturnMethod" DROP COLUMN "SearchKeywordConfigID";
