-- CreateEnum
CREATE TYPE "IntentLevel" AS ENUM ('High', 'Medium', 'Normal');

-- AlterEnum
ALTER TYPE "EventUserField" ADD VALUE 'AnonymousId';

-- AlterTable
ALTER TABLE "TrackingRule" ADD COLUMN     "IntentLevel" "IntentLevel";
