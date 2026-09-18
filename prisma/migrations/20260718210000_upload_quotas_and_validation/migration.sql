ALTER TABLE "assistant_attachment"
ADD COLUMN "contentHash" TEXT;

ALTER TABLE "drawing"
ADD COLUMN "storageKey" TEXT,
ADD COLUMN "fileName" TEXT,
ADD COLUMN "mediaType" TEXT,
ADD COLUMN "sizeBytes" INTEGER,
ADD COLUMN "contentHash" TEXT;

ALTER TABLE "task_update"
ADD COLUMN "storageKey" TEXT,
ADD COLUMN "fileName" TEXT,
ADD COLUMN "mediaType" TEXT,
ADD COLUMN "sizeBytes" INTEGER,
ADD COLUMN "contentHash" TEXT;

CREATE UNIQUE INDEX "drawing_storageKey_key" ON "drawing"("storageKey");
CREATE UNIQUE INDEX "task_update_storageKey_key" ON "task_update"("storageKey");
CREATE INDEX "assistant_attachment_projectId_contentHash_idx"
ON "assistant_attachment"("projectId", "contentHash");
CREATE INDEX "drawing_projectId_contentHash_idx" ON "drawing"("projectId", "contentHash");
CREATE INDEX "task_update_contentHash_idx" ON "task_update"("contentHash");
