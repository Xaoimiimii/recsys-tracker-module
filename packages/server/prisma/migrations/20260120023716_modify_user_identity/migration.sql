/*
  Warnings:

  - You are about to drop the column `IsActivated` on the `UserIdentity` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserIdentityField" AS ENUM ('UserId', 'AnonymousId');

-- AlterTable
ALTER TABLE "UserIdentity" DROP COLUMN "IsActivated",
ADD COLUMN     "Field" "UserIdentityField";
