-- AlterEnum
ALTER TYPE "PayloadSource" ADD VALUE 'RequestUrl';

-- AlterTable
ALTER TABLE "PayloadMapping" ADD COLUMN     "RequestUrl" TEXT;
