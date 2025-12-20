/*
  Warnings:

  - You are about to drop the column `version` on the `modules` table. All the data in the column will be lost.
  - Added the required column `numberOfEndplates` to the `modules` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable: Add the new column with a default value first
ALTER TABLE "modules" ADD COLUMN "numberOfEndplates" INTEGER NOT NULL DEFAULT 1;

-- Update existing records to have meaningful endplate counts (you can adjust these values as needed)
UPDATE "modules" SET "numberOfEndplates" = 2 WHERE "name" = 'React UI Components';
UPDATE "modules" SET "numberOfEndplates" = 4 WHERE "name" = 'Authentication Service';
UPDATE "modules" SET "numberOfEndplates" = 8 WHERE "name" = 'Data Processing Pipeline';
UPDATE "modules" SET "numberOfEndplates" = 2 WHERE "name" = 'Legacy Payment Gateway';
UPDATE "modules" SET "numberOfEndplates" = 3 WHERE "name" = 'Mobile SDK';
UPDATE "modules" SET "numberOfEndplates" = 6 WHERE "name" = 'Analytics Dashboard';

-- Drop the version column
ALTER TABLE "modules" DROP COLUMN "version";
