-- CreateEnum
CREATE TYPE "TernantRole" AS ENUM ('CUSTOMER', 'ADMIN');

-- AlterTable
ALTER TABLE "Ternant" ADD COLUMN     "Role" "TernantRole" NOT NULL DEFAULT 'CUSTOMER';
