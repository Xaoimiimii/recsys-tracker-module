-- CreateTable
CREATE TABLE "Category" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ItemCategory" (
    "CategoryId" INTEGER NOT NULL,
    "ItemId" INTEGER NOT NULL,

    CONSTRAINT "ItemCategory_pkey" PRIMARY KEY ("CategoryId","ItemId")
);

-- CreateTable
CREATE TABLE "Item" (
    "Id" SERIAL NOT NULL,
    "TernantId" INTEGER NOT NULL,
    "Title" TEXT NOT NULL,
    "EmbeddingVector" DOUBLE PRECISION[],
    "ModifiedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Model" (
    "Id" SERIAL NOT NULL,
    "Name" TEXT NOT NULL,
    "Description" TEXT,
    "AverageRating" DOUBLE PRECISION NOT NULL,
    "LearnableParameters" DOUBLE PRECISION[],
    "ModifiedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Model_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "ItemFactor" (
    "Id" SERIAL NOT NULL,
    "ItemId" INTEGER NOT NULL,
    "ModelId" INTEGER NOT NULL,
    "ItemBias" DOUBLE PRECISION NOT NULL,
    "ItemFactors" DOUBLE PRECISION[],

    CONSTRAINT "ItemFactor_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "User" (
    "Id" SERIAL NOT NULL,
    "TernantId" INTEGER NOT NULL,
    "UserEmbeddingVector" DOUBLE PRECISION[],
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ModifiedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "UserFactor" (
    "Id" SERIAL NOT NULL,
    "UserId" INTEGER NOT NULL,
    "ModelId" INTEGER NOT NULL,
    "UserBias" DOUBLE PRECISION NOT NULL,
    "UserFactors" DOUBLE PRECISION[],

    CONSTRAINT "UserFactor_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Predict" (
    "UserId" INTEGER NOT NULL,
    "ItemId" INTEGER NOT NULL,
    "Value" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "Predict_pkey" PRIMARY KEY ("UserId","ItemId")
);

-- CreateTable
CREATE TABLE "Rating" (
    "Id" SERIAL NOT NULL,
    "UserId" INTEGER NOT NULL,
    "ItemId" INTEGER NOT NULL,
    "TernantId" INTEGER NOT NULL,
    "Value" DOUBLE PRECISION NOT NULL,
    "ReviewText" TEXT,
    "ConvertedScore" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("Id")
);

-- CreateTable
CREATE TABLE "Interaction" (
    "Id" SERIAL NOT NULL,
    "UserId" INTEGER NOT NULL,
    "ItemId" INTEGER NOT NULL,
    "InteractionType" TEXT NOT NULL,
    "CreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interaction_pkey" PRIMARY KEY ("Id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rating_UserId_ItemId_key" ON "Rating"("UserId", "ItemId");

-- CreateIndex
CREATE INDEX "Interaction_UserId_idx" ON "Interaction"("UserId");

-- CreateIndex
CREATE INDEX "Interaction_ItemId_idx" ON "Interaction"("ItemId");

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_CategoryId_fkey" FOREIGN KEY ("CategoryId") REFERENCES "Category"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemCategory" ADD CONSTRAINT "ItemCategory_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "Item"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Item" ADD CONSTRAINT "Item_TernantId_fkey" FOREIGN KEY ("TernantId") REFERENCES "Ternant"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemFactor" ADD CONSTRAINT "ItemFactor_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "Item"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemFactor" ADD CONSTRAINT "ItemFactor_ModelId_fkey" FOREIGN KEY ("ModelId") REFERENCES "Model"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_TernantId_fkey" FOREIGN KEY ("TernantId") REFERENCES "Ternant"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFactor" ADD CONSTRAINT "UserFactor_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFactor" ADD CONSTRAINT "UserFactor_ModelId_fkey" FOREIGN KEY ("ModelId") REFERENCES "Model"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Predict" ADD CONSTRAINT "Predict_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Predict" ADD CONSTRAINT "Predict_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "Item"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "Item"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_TernantId_fkey" FOREIGN KEY ("TernantId") REFERENCES "Ternant"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interaction" ADD CONSTRAINT "Interaction_ItemId_fkey" FOREIGN KEY ("ItemId") REFERENCES "Item"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
