/*
  Warnings:

  - You are about to drop the column `IntentLevel` on the `TrackingRule` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('View', 'AddToFavorite', 'AddToWishlist', 'AddToCart', 'Purchase', 'Submit');

-- AlterTable
ALTER TABLE "TrackingRule" DROP COLUMN "IntentLevel",
ADD COLUMN     "ActionType" "ActionType";

-- DropEnum
DROP TYPE "IntentLevel";
