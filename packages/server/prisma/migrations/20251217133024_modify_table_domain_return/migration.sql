/*
  Warnings:

  - The primary key for the `DomainReturn` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `SlotName` on the `DomainReturn` table. All the data in the column will be lost.
  - You are about to drop the column `TargetUrl` on the `DomainReturn` table. All the data in the column will be lost.
  - Added the required column `ConfigurationName` to the `DomainReturn` table without a default value. This is not possible if the table is not empty.
  - Added the required column `OperatorID` to the `DomainReturn` table without a default value. This is not possible if the table is not empty.
  - Made the column `Value` on table `DomainReturn` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "DomainReturn" DROP CONSTRAINT "DomainReturn_pkey",
DROP COLUMN "SlotName",
DROP COLUMN "TargetUrl",
ADD COLUMN     "ConfigurationName" TEXT NOT NULL,
ADD COLUMN     "Id" SERIAL NOT NULL,
ADD COLUMN     "OperatorID" INTEGER NOT NULL,
ALTER COLUMN "Value" SET NOT NULL,
ADD CONSTRAINT "DomainReturn_pkey" PRIMARY KEY ("Id");

-- AddForeignKey
ALTER TABLE "DomainReturn" ADD CONSTRAINT "DomainReturn_OperatorID_fkey" FOREIGN KEY ("OperatorID") REFERENCES "Operator"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
