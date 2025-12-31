/*
  Warnings:

  - A unique constraint covering the columns `[DomainId,DomainItemId]` on the table `Item` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Item_DomainId_DomainItemId_key" ON "Item"("DomainId", "DomainItemId");
