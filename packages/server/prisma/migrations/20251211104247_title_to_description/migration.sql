/*
  Warnings:

  - You are about to drop the column `Title` on the `Item` table. All the data in the column will be lost.
  - Added the required column `Description` to the `Item` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Item" DROP COLUMN "Title",
ADD COLUMN     "Description" TEXT NOT NULL;
