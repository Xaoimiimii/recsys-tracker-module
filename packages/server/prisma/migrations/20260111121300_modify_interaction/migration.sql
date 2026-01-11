-- DropForeignKey
ALTER TABLE "Interaction" DROP CONSTRAINT "Interaction_InteractionTypeId_fkey";

-- AlterTable
ALTER TABLE "Interaction" ALTER COLUMN "InteractionTypeId" DROP NOT NULL;
