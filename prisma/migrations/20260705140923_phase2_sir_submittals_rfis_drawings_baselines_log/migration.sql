-- CreateEnum
CREATE TYPE "SirStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubmittalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'REVISE_RESUBMIT');

-- CreateEnum
CREATE TYPE "RfiStatus" AS ENUM ('OPEN', 'ANSWERED', 'CLOSED');

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "sequenceOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "schedule_impact_request" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "description" TEXT NOT NULL,
    "proposedNewEndDate" TIMESTAMP(3),
    "status" "SirStatus" NOT NULL DEFAULT 'PENDING',
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "schedule_impact_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submittal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "specSection" TEXT,
    "status" "SubmittalStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "submittal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfi" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT,
    "status" "RfiStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "raisedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rfi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drawing" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "discipline" TEXT,
    "fileUrl" TEXT NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "isSuperseded" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drawing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "baseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "baseline_task_snapshot" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "TaskStatus" NOT NULL,

    CONSTRAINT "baseline_task_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log_entry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "taskName" TEXT,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_entry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "schedule_impact_request_projectId_idx" ON "schedule_impact_request"("projectId");

-- CreateIndex
CREATE INDEX "submittal_projectId_idx" ON "submittal"("projectId");

-- CreateIndex
CREATE INDEX "rfi_projectId_idx" ON "rfi"("projectId");

-- CreateIndex
CREATE INDEX "drawing_projectId_idx" ON "drawing"("projectId");

-- CreateIndex
CREATE INDEX "baseline_projectId_idx" ON "baseline"("projectId");

-- CreateIndex
CREATE INDEX "baseline_task_snapshot_baselineId_idx" ON "baseline_task_snapshot"("baselineId");

-- CreateIndex
CREATE INDEX "activity_log_entry_projectId_createdAt_idx" ON "activity_log_entry"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "schedule_impact_request" ADD CONSTRAINT "schedule_impact_request_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_impact_request" ADD CONSTRAINT "schedule_impact_request_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_impact_request" ADD CONSTRAINT "schedule_impact_request_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "project_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_impact_request" ADD CONSTRAINT "schedule_impact_request_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "project_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submittal" ADD CONSTRAINT "submittal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submittal" ADD CONSTRAINT "submittal_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submittal" ADD CONSTRAINT "submittal_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "project_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfi" ADD CONSTRAINT "rfi_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfi" ADD CONSTRAINT "rfi_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfi" ADD CONSTRAINT "rfi_raisedById_fkey" FOREIGN KEY ("raisedById") REFERENCES "project_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing" ADD CONSTRAINT "drawing_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing" ADD CONSTRAINT "drawing_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drawing" ADD CONSTRAINT "drawing_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "project_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline" ADD CONSTRAINT "baseline_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline" ADD CONSTRAINT "baseline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "project_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "baseline_task_snapshot" ADD CONSTRAINT "baseline_task_snapshot_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "baseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log_entry" ADD CONSTRAINT "activity_log_entry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log_entry" ADD CONSTRAINT "activity_log_entry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

