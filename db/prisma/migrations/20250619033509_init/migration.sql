-- CreateEnum
CREATE TYPE "ModuleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DEPRECATED', 'DEVELOPMENT');

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" TEXT NOT NULL,
    "status" "ModuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT NOT NULL,
    "author" TEXT,
    "repository" TEXT,
    "documentation" TEXT,
    "dependencies" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "modules_name_key" ON "modules"("name");
