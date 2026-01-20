/*
  Warnings:

  - You are about to drop the `PayloadMapping` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "ItemIdentitySource" AS ENUM ('request_body', 'request_url');

-- CreateEnum
CREATE TYPE "UserIdentitySource" AS ENUM ('request_body', 'local_storage', 'session_storage', 'cookie', 'element');

-- DropForeignKey
ALTER TABLE "PayloadMapping" DROP CONSTRAINT "PayloadMapping_TrackingRuleId_fkey";

-- DropTable
DROP TABLE "PayloadMapping";

-- DropEnum
DROP TYPE "PayloadField";

-- DropEnum
DROP TYPE "PayloadRequestMethod";

-- DropEnum
DROP TYPE "PayloadSource";

-- DropEnum
DROP TYPE "PayloadUrlPart";

-- CreateTable
CREATE TABLE "ItemIdentity" (
    "Id" SERIAL NOT NULL,
    "Source" "ItemIdentitySource" NOT NULL,
    "TrackingRuleId" INTEGER NOT NULL,
    "RequestConfig" JSONB,

    CONSTRAINT "ItemIdentity_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "UserIdentity" (
    "Id" SERIAL NOT NULL,
    "Source" "UserIdentitySource" NOT NULL,
    "DomainId" INTEGER NOT NULL,
    "RequestConfig" JSONB,
    "Value" TEXT,

    CONSTRAINT "UserIdentity_pkey" PRIMARY KEY ("Id")
);

-- AddForeignKey
ALTER TABLE "ItemIdentity" ADD CONSTRAINT "ItemIdentity_TrackingRuleId_fkey" FOREIGN KEY ("TrackingRuleId") REFERENCES "TrackingRule"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserIdentity" ADD CONSTRAINT "UserIdentity_DomainId_fkey" FOREIGN KEY ("DomainId") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
