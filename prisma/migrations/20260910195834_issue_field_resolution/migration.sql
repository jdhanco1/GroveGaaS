-- AlterTable
ALTER TABLE "IssueReport" ADD COLUMN     "needsHelp" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "resolvedByWorkerId" TEXT,
ADD COLUMN     "workerNote" TEXT;
