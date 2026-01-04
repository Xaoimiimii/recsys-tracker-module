/*
  Warnings:

  - You are about to drop the `WidgetDesign` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "WidgetDesign" DROP CONSTRAINT "WidgetDesign_DomainId_fkey";

-- AlterTable
ALTER TABLE "ReturnMethod" ADD COLUMN     "Customizing" JSONB,
ADD COLUMN     "Delay" DOUBLE PRECISION,
ADD COLUMN     "Layout" JSONB,
ADD COLUMN     "Style" JSONB;

-- DropTable
DROP TABLE "WidgetDesign";

-- DropEnum
DROP TYPE "WidgetType";
