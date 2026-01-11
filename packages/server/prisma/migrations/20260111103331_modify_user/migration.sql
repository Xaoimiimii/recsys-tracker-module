/*
  Warnings:

  - You are about to drop the column `DomainUserId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `Username` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[AnonymousId,UserId,DomainId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "User_DomainId_DomainUserId_key";

-- DropIndex
DROP INDEX "User_Username_DomainId_key";

-- DropIndex
DROP INDEX "User_Username_DomainUserId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "DomainUserId",
DROP COLUMN "Username",
ADD COLUMN     "AnonymousId" TEXT,
ADD COLUMN     "UserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_AnonymousId_UserId_DomainId_key" ON "User"("AnonymousId", "UserId", "DomainId");
