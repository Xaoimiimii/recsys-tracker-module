-- CreateTable
CREATE TABLE "Evaluation" (
    "Id" SERIAL NOT NULL,
    "UserId" INTEGER NOT NULL,
    "Rank" INTEGER NOT NULL,
    "Timestamp" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("Id")
);

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_UserId_fkey" FOREIGN KEY ("UserId") REFERENCES "User"("Id") ON DELETE RESTRICT ON UPDATE CASCADE;
