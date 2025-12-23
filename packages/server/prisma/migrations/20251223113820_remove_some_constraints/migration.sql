-- AlterTable
ALTER TABLE "Item" ALTER COLUMN "Description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ItemFactor" ALTER COLUMN "ItemBias" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Model" ALTER COLUMN "AverageRating" DROP NOT NULL;

-- AlterTable
ALTER TABLE "UserFactor" ALTER COLUMN "UserBias" DROP NOT NULL;
