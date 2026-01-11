/*
  Warnings:

  - You are about to drop the column `UserField` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `UserValue` on the `Event` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Event" DROP COLUMN "UserField",
DROP COLUMN "UserValue",
ADD COLUMN     "AnonymousId" TEXT,
ADD COLUMN     "UserId" TEXT;
