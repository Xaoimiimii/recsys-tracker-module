/*
  Warnings:

  - A unique constraint covering the columns `[DomainId,DomainUserId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[Username,DomainUserId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "User_DomainId_DomainUserId_key" ON "User"("DomainId", "DomainUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_Username_DomainUserId_key" ON "User"("Username", "DomainUserId");
