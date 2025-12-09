/*
  Warnings:

  - The primary key for the `DomainReturn` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `TargetUrl` on the `ReturnMethod` table. All the data in the column will be lost.
  - You are about to drop the column `Value` on the `ReturnMethod` table. All the data in the column will be lost.
  - Added the required column `SlotName` to the `DomainReturn` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DomainReturn" DROP CONSTRAINT "DomainReturn_pkey",
ADD COLUMN     "SlotName" TEXT NOT NULL,
ADD COLUMN     "TargetUrl" TEXT,
ADD COLUMN     "Value" TEXT,
ADD CONSTRAINT "DomainReturn_pkey" PRIMARY KEY ("DomainID", "SlotName");

-- AlterTable
ALTER TABLE "ReturnMethod" DROP COLUMN "TargetUrl",
DROP COLUMN "Value";
