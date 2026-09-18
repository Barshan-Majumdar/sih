-- Preserve the project document citation that produced a submittal or roadblock.
ALTER TABLE "submittal" ADD COLUMN "attachmentId" TEXT;
ALTER TABLE "submittal" ADD COLUMN "pageNumber" INTEGER;
ALTER TABLE "submittal" ADD COLUMN "citationExcerpt" TEXT;

ALTER TABLE "task" ADD COLUMN "roadblockAttachmentId" TEXT;
ALTER TABLE "task" ADD COLUMN "roadblockPageNumber" INTEGER;
ALTER TABLE "task" ADD COLUMN "roadblockCitationExcerpt" TEXT;

CREATE INDEX "submittal_attachmentId_idx" ON "submittal"("attachmentId");
CREATE INDEX "task_roadblockAttachmentId_idx" ON "task"("roadblockAttachmentId");

ALTER TABLE "submittal"
ADD CONSTRAINT "submittal_attachmentId_fkey"
FOREIGN KEY ("attachmentId") REFERENCES "assistant_attachment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "task"
ADD CONSTRAINT "task_roadblockAttachmentId_fkey"
FOREIGN KEY ("roadblockAttachmentId") REFERENCES "assistant_attachment"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
