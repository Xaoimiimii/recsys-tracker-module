/*
  Warnings:

  - A unique constraint covering the columns `[ItemId,ModelId]` on the table `ItemFactor` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[UserId,ModelId]` on the table `UserFactor` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "ItemFactor_ItemId_ModelId_key" ON "ItemFactor"("ItemId", "ModelId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFactor_UserId_ModelId_key" ON "UserFactor"("UserId", "ModelId");
