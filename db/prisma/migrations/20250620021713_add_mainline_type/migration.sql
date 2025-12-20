-- CreateEnum
CREATE TYPE "MainlineType" AS ENUM ('SINGLE', 'DOUBLE');

-- AlterTable
ALTER TABLE "modules" ADD COLUMN     "numberOfMainlines" "MainlineType" NOT NULL DEFAULT 'SINGLE';
