/*
  Warnings:

  - You are about to drop the column `latitude` on the `Generator` table. All the data in the column will be lost.
  - You are about to drop the column `longitude` on the `Generator` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Generator" DROP COLUMN "latitude",
DROP COLUMN "longitude";
