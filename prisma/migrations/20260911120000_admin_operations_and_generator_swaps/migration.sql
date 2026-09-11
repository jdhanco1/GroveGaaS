-- AlterEnum
ALTER TYPE "ActorType" ADD VALUE 'ADMIN';

-- CreateEnum
CREATE TYPE "GeneratorOperation" AS ENUM ('REFUEL', 'POWER_ON', 'SHUTDOWN');

-- AlterTable
ALTER TABLE "ScanEvent" ADD COLUMN "operation" "GeneratorOperation";

-- Preserve historical display semantics for existing refuel events.
UPDATE "ScanEvent"
SET "operation" = CASE
  WHEN "generatorRunning" = false THEN 'SHUTDOWN'::"GeneratorOperation"
  ELSE 'REFUEL'::"GeneratorOperation"
END
WHERE "type" = 'REFUEL';

-- CreateTable
CREATE TABLE "GeneratorSwap" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "originalGeneratorId" TEXT NOT NULL,
    "replacementGeneratorId" TEXT NOT NULL,
    "originalAssignmentId" TEXT NOT NULL,
    "replacementAssignmentId" TEXT NOT NULL,
    "startedById" TEXT NOT NULL,
    "restoredById" TEXT,
    "reason" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "restoredAt" TIMESTAMP(3),

    CONSTRAINT "GeneratorSwap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GeneratorSwap_originalAssignmentId_key" ON "GeneratorSwap"("originalAssignmentId");
CREATE UNIQUE INDEX "GeneratorSwap_replacementAssignmentId_key" ON "GeneratorSwap"("replacementAssignmentId");
CREATE INDEX "GeneratorSwap_originalGeneratorId_restoredAt_idx" ON "GeneratorSwap"("originalGeneratorId", "restoredAt");
CREATE INDEX "GeneratorSwap_replacementGeneratorId_restoredAt_idx" ON "GeneratorSwap"("replacementGeneratorId", "restoredAt");
CREATE INDEX "GeneratorSwap_customerId_restoredAt_idx" ON "GeneratorSwap"("customerId", "restoredAt");

-- A physical generator can have only one current assignment.
CREATE UNIQUE INDEX "Assignment_one_active_per_generator" ON "Assignment"("generatorId") WHERE "unassignedAt" IS NULL;

-- AddForeignKey
ALTER TABLE "GeneratorSwap" ADD CONSTRAINT "GeneratorSwap_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratorSwap" ADD CONSTRAINT "GeneratorSwap_originalGeneratorId_fkey" FOREIGN KEY ("originalGeneratorId") REFERENCES "Generator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratorSwap" ADD CONSTRAINT "GeneratorSwap_replacementGeneratorId_fkey" FOREIGN KEY ("replacementGeneratorId") REFERENCES "Generator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratorSwap" ADD CONSTRAINT "GeneratorSwap_originalAssignmentId_fkey" FOREIGN KEY ("originalAssignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratorSwap" ADD CONSTRAINT "GeneratorSwap_replacementAssignmentId_fkey" FOREIGN KEY ("replacementAssignmentId") REFERENCES "Assignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratorSwap" ADD CONSTRAINT "GeneratorSwap_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GeneratorSwap" ADD CONSTRAINT "GeneratorSwap_restoredById_fkey" FOREIGN KEY ("restoredById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;