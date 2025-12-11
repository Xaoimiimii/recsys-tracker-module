/*
  Warnings:

  - You are about to drop the column `TernantId` on the `Item` table. All the data in the column will be lost.
  - You are about to drop the column `TernantId` on the `Rating` table. All the data in the column will be lost.
  - You are about to drop the column `TernantId` on the `User` table. All the data in the column will be lost.
  - Added the required column `DomainId` to the `Item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DomainId` to the `Rating` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DomainId` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Item" DROP CONSTRAINT "Item_TernantId_fkey";

-- DropForeignKey
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_TernantId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_TernantId_fkey";

-- AlterTable
ALTER TABLE "Item" DROP COLUMN "TernantId",
ADD COLUMN     "DomainId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Rating" DROP COLUMN "TernantId",
ADD COLUMN     "DomainId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "TernantId",
ADD COLUMN     "DomainId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_DomainId_fkey" FOREIGN KEY ("DomainId") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_DomainId_fkey" FOREIGN KEY ("DomainId") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_DomainId_fkey" FOREIGN KEY ("DomainId") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
