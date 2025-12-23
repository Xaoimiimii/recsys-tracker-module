/*
  Warnings:

  - A unique constraint covering the columns `[DomainId,Name]` on the table `Model` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `DomainId` to the `Model` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Model" ADD COLUMN     "DomainId" INTEGER NOT NULL,
ALTER COLUMN "ModifiedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "ModifiedAt" SET DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Model_DomainId_Name_key" ON "Model"("DomainId", "Name");

-- AddForeignKey
ALTER TABLE "Model" ADD CONSTRAINT "Model_DomainId_fkey" FOREIGN KEY ("DomainId") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
