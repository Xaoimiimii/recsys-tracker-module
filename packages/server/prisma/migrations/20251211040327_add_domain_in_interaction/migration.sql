/*
  Warnings:

  - Added the required column `DomainId` to the `Interaction` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN     "DomainId" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_DomainId_fkey" FOREIGN KEY ("DomainId") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
