CREATE TYPE "ActivitySource" AS ENUM ('UI', 'AGENT', 'SYSTEM', 'INTEGRATION');

ALTER TABLE "activity_log_entry"
ADD COLUMN "entityType" TEXT,
ADD COLUMN "entityId" TEXT,
ADD COLUMN "source" "ActivitySource" NOT NULL DEFAULT 'UI',
ADD COLUMN "changes" JSONB;

CREATE INDEX "activity_log_entry_projectId_source_createdAt_idx"
ON "activity_log_entry"("projectId", "source", "createdAt");

CREATE INDEX "activity_log_entry_projectId_entityType_createdAt_idx"
ON "activity_log_entry"("projectId", "entityType", "createdAt");
