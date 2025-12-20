/*
  Warnings:

  - You are about to drop the column `author` on the `modules` table. All the data in the column will be lost.
  - You are about to drop the column `repository` on the `modules` table. All the data in the column will be lost.

*/
-- AlterTable: Rename columns to preserve data
ALTER TABLE "modules" RENAME COLUMN "author" TO "owner";
ALTER TABLE "modules" RENAME COLUMN "repository" TO "location";
