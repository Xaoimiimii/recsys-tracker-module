-- CreateEnum
CREATE TYPE "WidgetType" AS ENUM ('INLINE_INJECTION', 'POPUP');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "Attributes" JSONB,
ADD COLUMN     "ImageUrl" TEXT;

-- CreateTable
CREATE TABLE "WidgetDesign" (
    "Id" SERIAL NOT NULL,
    "DomainId" INTEGER NOT NULL,
    "CustomizingFields" JSONB NOT NULL,
    "Type" "WidgetType" NOT NULL,
    "Layout" JSONB NOT NULL,
    "Style" JSONB NOT NULL,
    "IsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "DelayDuration" INTEGER NOT NULL DEFAULT 120,

    CONSTRAINT "WidgetDesign_pkey" PRIMARY KEY ("Id")
);

-- AddForeignKey
ALTER TABLE "WidgetDesign" ADD CONSTRAINT "WidgetDesign_DomainId_fkey" FOREIGN KEY ("DomainId") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
