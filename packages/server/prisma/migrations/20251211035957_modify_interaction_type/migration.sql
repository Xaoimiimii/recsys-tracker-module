/*
  Warnings:

  - You are about to drop the column `InteractionType` on the `Interaction` table. All the data in the column will be lost.
  - Added the required column `InteractionTypeId` to the `Interaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Interaction" DROP COLUMN "InteractionType",
ADD COLUMN     "InteractionTypeId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_InteractionTypeId_fkey" FOREIGN KEY ("InteractionTypeId") REFERENCES "TriggerEvent"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
