/*
  Warnings:

  - A unique constraint covering the columns `[DomainItemId]` on the table `Item` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "DomainItemId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Item_DomainItemId_key" ON "Item"("DomainItemId");
