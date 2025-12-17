/*
  Warnings:

  - You are about to drop the column `UserId` on the `Interaction` table. All the data in the column will be lost.
  - You are about to drop the column `UserId` on the `Rating` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[Username,ItemId]` on the table `Rating` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[Username,DomainId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Interaction" DROP CONSTRAINT "Interaction_UserId_fkey";

-- DropForeignKey
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_UserId_fkey";

-- DropIndex
DROP INDEX "Interaction_UserId_idx";

-- DropIndex
DROP INDEX "Rating_UserId_ItemId_key";

-- AlterTable
ALTER TABLE "Interaction" DROP COLUMN "UserId",
ADD COLUMN     "Username" TEXT;

-- AlterTable
ALTER TABLE "Rating" DROP COLUMN "UserId",
ADD COLUMN     "Username" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "Username" TEXT;

-- CreateIndex
CREATE INDEX "Interaction_Username_DomainId_idx" ON "Interaction"("Username", "DomainId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_Username_ItemId_key" ON "Rating"("Username", "ItemId");

-- CreateIndex
CREATE UNIQUE INDEX "User_Username_DomainId_key" ON "User"("Username", "DomainId");

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_Username_DomainId_fkey" FOREIGN KEY ("Username", "DomainId") REFERENCES "User"("Username", "DomainId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_Username_DomainId_fkey" FOREIGN KEY ("Username", "DomainId") REFERENCES "User"("Username", "DomainId") ON DELETE RESTRICT ON UPDATE CASCADE;
