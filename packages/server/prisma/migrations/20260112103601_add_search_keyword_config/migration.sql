-- AlterTable
ALTER TABLE "ReturnMethod" ADD COLUMN     "SearchKeywordConfigID" INTEGER;

-- CreateTable
CREATE TABLE "SearchKeywordConfig" (
    "Id" SERIAL NOT NULL,
    "DomainID" INTEGER NOT NULL,
    "ConfigurationName" TEXT NOT NULL,
    "InputSelector" TEXT NOT NULL,

    CONSTRAINT "SearchKeywordConfig_pkey" PRIMARY KEY ("Id")
);

-- AddForeignKey
ALTER TABLE "ReturnMethod" ADD CONSTRAINT "ReturnMethod_SearchKeywordConfigID_fkey" FOREIGN KEY ("SearchKeywordConfigID") REFERENCES "SearchKeywordConfig"("Id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchKeywordConfig" ADD CONSTRAINT "SearchKeywordConfig_DomainID_fkey" FOREIGN KEY ("DomainID") REFERENCES "Domain"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
