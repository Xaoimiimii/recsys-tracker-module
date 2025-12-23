/*
  Warnings:

  - You are about to drop the column `OperatorID` on the `TrackingTarget` table. All the data in the column will be lost.
  - Changed the type of `UserField` on the `Event` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `ItemField` on the `Event` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `OperatorId` to the `TrackingTarget` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "EventUserField" AS ENUM ('UserId', 'Username');

-- CreateEnum
CREATE TYPE "EventItemField" AS ENUM ('ItemId', 'ItemTitle');

-- DropForeignKey
ALTER TABLE "TrackingTarget" DROP CONSTRAINT "TrackingTarget_OperatorID_fkey";

-- DropIndex
DROP INDEX "Item_DomainItemId_key";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "UserField",
ADD COLUMN     "UserField" "EventUserField" NOT NULL,
DROP COLUMN "ItemField",
ADD COLUMN     "ItemField" "EventItemField" NOT NULL;

-- AlterTable
ALTER TABLE "TrackingTarget" DROP COLUMN "OperatorID",
ADD COLUMN     "OperatorId" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "DomainUserId" TEXT;

-- AddForeignKey
ALTER TABLE "TrackingTarget" ADD CONSTRAINT "TrackingTarget_OperatorId_fkey" FOREIGN KEY ("OperatorId") REFERENCES "Operator"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
