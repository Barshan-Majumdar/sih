-- CreateEnum
CREATE TYPE "AssistantActionKind" AS ENUM ('ROADBLOCK_CHANGE');

-- CreateEnum
CREATE TYPE "AssistantActionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "assistant_action_proposal" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "kind" "AssistantActionKind" NOT NULL,
    "status" "AssistantActionStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "result" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_action_proposal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assistant_action_proposal_conversationId_createdAt_idx" ON "assistant_action_proposal"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "assistant_action_proposal_createdById_status_idx" ON "assistant_action_proposal"("createdById", "status");

-- CreateIndex
CREATE INDEX "assistant_action_proposal_projectId_taskId_idx" ON "assistant_action_proposal"("projectId", "taskId");

-- AddForeignKey
ALTER TABLE "assistant_action_proposal" ADD CONSTRAINT "assistant_action_proposal_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
