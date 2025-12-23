/*
  Warnings:

  - You are about to drop the column `EventPatternID` on the `Condition` table. All the data in the column will be lost.
  - You are about to drop the column `RuleID` on the `Condition` table. All the data in the column will be lost.
  - You are about to drop the column `Username` on the `Interaction` table. All the data in the column will be lost.
  - You are about to drop the column `Username` on the `Rating` table. All the data in the column will be lost.
  - You are about to drop the column `Name` on the `ReturnMethod` table. All the data in the column will be lost.
  - You are about to drop the `DomainReturn` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventPattern` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PayloadConfig` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PayloadPattern` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Rule` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TargetElement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TriggerEvent` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[UserId,ItemId]` on the table `Rating` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `PatternId` to the `Condition` table without a default value. This is not possible if the table is not empty.
  - Added the required column `TrackingRuleID` to the `Condition` table without a default value. This is not possible if the table is not empty.
  - Added the required column `UserId` to the `Interaction` table without a default value. This is not possible if the table is not empty.
  - Added the required column `UserId` to the `Rating` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ConfigurationName` to the `ReturnMethod` table without a default value. This is not possible if the table is not empty.
  - Added the required column `DomainID` to the `ReturnMethod` table without a default value. This is not possible if the table is not empty.
  - Added the required column `OperatorID` to the `ReturnMethod` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ReturnType` to the `ReturnMethod` table without a default value. This is not possible if the table is not empty.
  - Added the required column `Value` to the `ReturnMethod` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "ReturnType" AS ENUM ('POPUP', 'INLINE_INJECTION');

-- CreateEnum
CREATE TYPE "PayloadField" AS ENUM ('UserId', 'Username', 'ItemId', 'ItemTitle', 'Value');

-- CreateEnum
CREATE TYPE "PayloadSource" AS ENUM ('RequestBody', 'Element', 'Cookie', 'LocalStorage', 'SessionStorage', 'Url');

-- CreateEnum
CREATE TYPE "PayloadRequestMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH');

-- CreateEnum
CREATE TYPE "PayloadUrlPart" AS ENUM ('QueryParam', 'PathName', 'Hash');

-- DropForeignKey
ALTER TABLE "Condition" DROP CONSTRAINT "Condition_EventPatternID_fkey";

-- DropForeignKey
ALTER TABLE "Condition" DROP CONSTRAINT "Condition_RuleID_fkey";

-- DropForeignKey
ALTER TABLE "DomainReturn" DROP CONSTRAINT "DomainReturn_DomainID_fkey";

-- DropForeignKey
ALTER TABLE "DomainReturn" DROP CONSTRAINT "DomainReturn_OperatorID_fkey";

-- DropForeignKey
ALTER TABLE "DomainReturn" DROP CONSTRAINT "DomainReturn_ReturnMethodID_fkey";

-- DropForeignKey
ALTER TABLE "Interaction" DROP CONSTRAINT "Interaction_InteractionTypeId_fkey";

-- DropForeignKey
ALTER TABLE "Interaction" DROP CONSTRAINT "Interaction_Username_DomainId_fkey";

-- DropForeignKey
ALTER TABLE "PayloadConfig" DROP CONSTRAINT "PayloadConfig_OperatorID_fkey";

-- DropForeignKey
ALTER TABLE "PayloadConfig" DROP CONSTRAINT "PayloadConfig_PayloadPatternID_fkey";

-- DropForeignKey
ALTER TABLE "PayloadConfig" DROP CONSTRAINT "PayloadConfig_RuleID_fkey";

-- DropForeignKey
ALTER TABLE "Rating" DROP CONSTRAINT "Rating_Username_DomainId_fkey";

-- DropForeignKey
ALTER TABLE "Rule" DROP CONSTRAINT "Rule_DomainID_fkey";

-- DropForeignKey
ALTER TABLE "Rule" DROP CONSTRAINT "Rule_TargetElementID_fkey";

-- DropForeignKey
ALTER TABLE "Rule" DROP CONSTRAINT "Rule_TriggerEventID_fkey";

-- DropForeignKey
ALTER TABLE "TargetElement" DROP CONSTRAINT "TargetElement_EventPatternID_fkey";

-- DropForeignKey
ALTER TABLE "TargetElement" DROP CONSTRAINT "TargetElement_OperatorID_fkey";

-- DropIndex
DROP INDEX "Interaction_ItemId_idx";

-- DropIndex
DROP INDEX "Interaction_Username_DomainId_idx";

-- DropIndex
DROP INDEX "Rating_Username_ItemId_key";

-- AlterTable
ALTER TABLE "Condition" DROP COLUMN "EventPatternID",
DROP COLUMN "RuleID",
ADD COLUMN     "PatternId" INTEGER NOT NULL,
ADD COLUMN     "TrackingRuleID" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Interaction" DROP COLUMN "Username",
ADD COLUMN     "UserId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Rating" DROP COLUMN "Username",
ADD COLUMN     "UserId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "ReturnMethod" DROP COLUMN "Name",
ADD COLUMN     "ConfigurationName" TEXT NOT NULL,
ADD COLUMN     "DomainID" INTEGER NOT NULL,
ADD COLUMN     "OperatorID" INTEGER NOT NULL,
ADD COLUMN     "ReturnType" "ReturnType" NOT NULL,
ADD COLUMN     "Value" TEXT NOT NULL;

-- DropTable
DROP TABLE "DomainReturn";

-- DropTable
DROP TABLE "EventPattern";

-- DropTable
DROP TABLE "PayloadConfig";

-- DropTable
DROP TABLE "PayloadPattern";

-- DropTable
DROP TABLE "Rule";

-- DropTable
DROP TABLE "TargetElement";

-- DropTable
DROP TABLE "TriggerEvent";

-- CreateTable
CREATE TABLE "TrackingRule" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "DomainID" INTEGER NOT NULL,
    "EventTypeID" INTEGER NOT NULL,
    "TrackingTargetId" INTEGER NOT NULL,

    CONSTRAINT "TrackingRule_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "EventType" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,

    CONSTRAINT "EventType_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "TrackingTarget" (
    "Id" SERIAL NOT NULL,
    "Value" TEXT NOT NULL,
    "PatternId" INTEGER NOT NULL,
    "OperatorID" INTEGER NOT NULL,

    CONSTRAINT "TrackingTarget_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Pattern" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,

    CONSTRAINT "Pattern_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "PayloadMapping" (
    "Id" SERIAL NOT NULL,
    "Field" "PayloadField" NOT NULL,
    "Source" "PayloadSource" NOT NULL,
    "Value" TEXT,
    "RequestUrlPattern" TEXT,
    "RequestMethod" "PayloadRequestMethod",
    "RequestBodyPath" TEXT,
    "UrlPart" "PayloadUrlPart",
    "UrlPartValue" TEXT,
    "TrackingRuleId" INTEGER NOT NULL,

    CONSTRAINT "PayloadMapping_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Event" (
    "Id" SERIAL NOT NULL,
    "EventTypeId" INTEGER NOT NULL,
    "UserField" TEXT NOT NULL,
    "UserValue" TEXT NOT NULL,
    "ItemField" TEXT NOT NULL,
    "ItemValue" TEXT NOT NULL,
    "RatingValue" INTEGER,
    "ReviewValue" TEXT,
    "Timestamp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_UserId_ItemId_key" ON "Rating"("UserId", "ItemId");

-- AddForeignKey
ALTER TABLE "ReturnMethod" ADD CONSTRAINT "ReturnMethod_DomainID_fkey" FOREIGN KEY ("DomainID") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnMethod" ADD CONSTRAINT "ReturnMethod_OperatorID_fkey" FOREIGN KEY ("OperatorID") REFERENCES "Operator"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingRule" ADD CONSTRAINT "TrackingRule_DomainID_fkey" FOREIGN KEY ("DomainID") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingRule" ADD CONSTRAINT "TrackingRule_EventTypeID_fkey" FOREIGN KEY ("EventTypeID") REFERENCES "EventType"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingRule" ADD CONSTRAINT "TrackingRule_TrackingTargetId_fkey" FOREIGN KEY ("TrackingTargetId") REFERENCES "TrackingTarget"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingTarget" ADD CONSTRAINT "TrackingTarget_PatternId_fkey" FOREIGN KEY ("PatternId") REFERENCES "Pattern"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingTarget" ADD CONSTRAINT "TrackingTarget_OperatorID_fkey" FOREIGN KEY ("OperatorID") REFERENCES "Operator"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_TrackingRuleID_fkey" FOREIGN KEY ("TrackingRuleID") REFERENCES "TrackingRule"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Condition" ADD CONSTRAINT "Condition_PatternId_fkey" FOREIGN KEY ("PatternId") REFERENCES "Pattern"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayloadMapping" ADD CONSTRAINT "PayloadMapping_TrackingRuleId_fkey" FOREIGN KEY ("TrackingRuleId") REFERENCES "TrackingRule"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_EventTypeId_fkey" FOREIGN KEY ("EventTypeId") REFERENCES "EventType"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_InteractionTypeId_fkey" FOREIGN KEY ("InteractionTypeId") REFERENCES "EventType"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
