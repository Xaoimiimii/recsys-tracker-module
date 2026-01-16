/*
  Warnings:

  - You are about to drop the column `ItemField` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `ItemValue` on the `Event` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "ItemField",
DROP COLUMN "ItemValue",
ADD COLUMN     "ItemId" TEXT;

-- DropEnum
DROP TYPE "EventItemField";
