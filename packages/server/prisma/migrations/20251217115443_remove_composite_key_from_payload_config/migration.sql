/*
  Warnings:

  - The primary key for the `PayloadConfig` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "PayloadConfig" DROP CONSTRAINT "PayloadConfig_pkey",
ADD COLUMN     "Id" SERIAL NOT NULL,
ADD CONSTRAINT "PayloadConfig_pkey" PRIMARY KEY ("Id");
