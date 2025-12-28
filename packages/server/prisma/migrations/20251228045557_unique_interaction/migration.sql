/*
  Warnings:

  - A unique constraint covering the columns `[UserId,ItemId,InteractionTypeId]` on the table `Interaction` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Interaction_UserId_ItemId_InteractionTypeId_key" ON "Interaction"("UserId", "ItemId", "InteractionTypeId");
