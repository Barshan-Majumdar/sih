-- Link RFIs to an optional project document citation (file + page + excerpt).
ALTER TABLE "rfi" ADD COLUMN "attachmentId" TEXT;
ALTER TABLE "rfi" ADD COLUMN "pageNumber" INTEGER;
ALTER TABLE "rfi" ADD COLUMN "citationExcerpt" TEXT;

CREATE INDEX "rfi_attachmentId_idx" ON "rfi"("attachmentId");

ALTER TABLE "rfi" ADD CONSTRAINT "rfi_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "assistant_attachment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
