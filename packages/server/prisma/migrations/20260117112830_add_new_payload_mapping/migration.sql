/*
  Warnings:

  - You are about to drop the `ItemIdentity` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "PayloadMappingField" AS ENUM ('ItemId', 'Rating', 'Review');

-- CreateEnum
CREATE TYPE "PayloadMappingSource" AS ENUM ('request_body', 'request_url');

-- DropForeignKey
ALTER TABLE "ItemIdentity" DROP CONSTRAINT "ItemIdentity_TrackingRuleId_fkey";

-- DropTable
DROP TABLE "ItemIdentity";

-- DropEnum
DROP TYPE "ItemIdentitySource";

-- CreateTable
CREATE TABLE "PayloadMapping" (
    "Id" SERIAL NOT NULL,
    "Field" "PayloadMappingField" NOT NULL,
    "Source" "PayloadMappingSource" NOT NULL,
    "Config" JSONB NOT NULL,
    "TrackingRuleId" INTEGER NOT NULL,

    CONSTRAINT "PayloadMapping_pkey" PRIMARY KEY ("Id")
);

-- AddForeignKey
ALTER TABLE "PayloadMapping" ADD CONSTRAINT "PayloadMapping_TrackingRuleId_fkey" FOREIGN KEY ("TrackingRuleId") REFERENCES "TrackingRule"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
