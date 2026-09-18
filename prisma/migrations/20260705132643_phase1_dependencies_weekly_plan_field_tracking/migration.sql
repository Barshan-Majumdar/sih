-- CreateEnum
CREATE TYPE "RoadblockType" AS ENUM ('CHANGE_ORDER', 'INSPECTION', 'LABOR', 'MATERIAL', 'WEATHER', 'OTHER');

-- CreateEnum
CREATE TYPE "CommitmentStatus" AS ENUM ('COMMITTED', 'COMPLETED', 'NOT_COMPLETED');

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "roadblockDueDate" TIMESTAMP(3),
ADD COLUMN     "roadblockOwnerId" TEXT,
ADD COLUMN     "roadblockType" "RoadblockType";

-- CreateTable
CREATE TABLE "task_dependency" (
    "id" TEXT NOT NULL,
    "predecessorId" TEXT NOT NULL,
    "successorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_commitment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "committedById" TEXT NOT NULL,
    "status" "CommitmentStatus" NOT NULL DEFAULT 'COMMITTED',
    "reasonForVariance" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weekly_commitment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_update" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "note" TEXT,
    "photoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_update_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_dependency_successorId_idx" ON "task_dependency"("successorId");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependency_predecessorId_successorId_key" ON "task_dependency"("predecessorId", "successorId");

-- CreateIndex
CREATE INDEX "weekly_commitment_weekStartDate_idx" ON "weekly_commitment"("weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_commitment_taskId_weekStartDate_key" ON "weekly_commitment"("taskId", "weekStartDate");

-- CreateIndex
CREATE INDEX "task_update_taskId_idx" ON "task_update"("taskId");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_roadblockOwnerId_fkey" FOREIGN KEY ("roadblockOwnerId") REFERENCES "project_member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_predecessorId_fkey" FOREIGN KEY ("predecessorId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependency" ADD CONSTRAINT "task_dependency_successorId_fkey" FOREIGN KEY ("successorId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_commitment" ADD CONSTRAINT "weekly_commitment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_commitment" ADD CONSTRAINT "weekly_commitment_committedById_fkey" FOREIGN KEY ("committedById") REFERENCES "project_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_update" ADD CONSTRAINT "task_update_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_update" ADD CONSTRAINT "task_update_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
