-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('WORKER', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('REFUEL', 'ISSUE_REPORT');

-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('OIL_CHANGE', 'REPAIR', 'INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratorType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tankCapacityGallons" DOUBLE PRECISION NOT NULL,
    "runtimeMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratorType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "MaintenanceCategory" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratorMaintenanceTag" (
    "id" TEXT NOT NULL,
    "generatorId" TEXT NOT NULL,
    "maintenanceTagId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "note" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratorMaintenanceTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Generator" (
    "id" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "generatorTypeId" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Generator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PinCredential" (
    "id" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "ownerType" "ActorType" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PinCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "generatorId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanEvent" (
    "id" TEXT NOT NULL,
    "generatorId" TEXT NOT NULL,
    "type" "ScanType" NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "clientTimestamp" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceId" TEXT,
    "clientEventId" TEXT NOT NULL,
    "gallonsAdded" DOUBLE PRECISION,
    "note" TEXT,

    CONSTRAINT "ScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueReport" (
    "id" TEXT NOT NULL,
    "generatorId" TEXT NOT NULL,
    "scanEventId" TEXT NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IssueReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE INDEX "GeneratorMaintenanceTag_generatorId_idx" ON "GeneratorMaintenanceTag"("generatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Generator_qrToken_key" ON "Generator"("qrToken");

-- CreateIndex
CREATE INDEX "Generator_generatorTypeId_idx" ON "Generator"("generatorTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "PinCredential_pinHash_key" ON "PinCredential"("pinHash");

-- CreateIndex
CREATE INDEX "PinCredential_ownerType_ownerId_idx" ON "PinCredential"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "Assignment_generatorId_unassignedAt_idx" ON "Assignment"("generatorId", "unassignedAt");

-- CreateIndex
CREATE INDEX "Assignment_customerId_unassignedAt_idx" ON "Assignment"("customerId", "unassignedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScanEvent_clientEventId_key" ON "ScanEvent"("clientEventId");

-- CreateIndex
CREATE INDEX "ScanEvent_generatorId_clientTimestamp_idx" ON "ScanEvent"("generatorId", "clientTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "IssueReport_scanEventId_key" ON "IssueReport"("scanEventId");

-- CreateIndex
CREATE INDEX "IssueReport_generatorId_status_idx" ON "IssueReport"("generatorId", "status");

-- AddForeignKey
ALTER TABLE "GeneratorMaintenanceTag" ADD CONSTRAINT "GeneratorMaintenanceTag_generatorId_fkey" FOREIGN KEY ("generatorId") REFERENCES "Generator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratorMaintenanceTag" ADD CONSTRAINT "GeneratorMaintenanceTag_maintenanceTagId_fkey" FOREIGN KEY ("maintenanceTagId") REFERENCES "MaintenanceTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Generator" ADD CONSTRAINT "Generator_generatorTypeId_fkey" FOREIGN KEY ("generatorTypeId") REFERENCES "GeneratorType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_generatorId_fkey" FOREIGN KEY ("generatorId") REFERENCES "Generator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_generatorId_fkey" FOREIGN KEY ("generatorId") REFERENCES "Generator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueReport" ADD CONSTRAINT "IssueReport_generatorId_fkey" FOREIGN KEY ("generatorId") REFERENCES "Generator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueReport" ADD CONSTRAINT "IssueReport_scanEventId_fkey" FOREIGN KEY ("scanEventId") REFERENCES "ScanEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IssueReport" ADD CONSTRAINT "IssueReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
