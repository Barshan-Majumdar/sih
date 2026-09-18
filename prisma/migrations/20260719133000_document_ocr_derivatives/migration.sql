ALTER TABLE "assistant_attachment"
ADD COLUMN "searchableStorageKey" TEXT,
ADD COLUMN "searchableFileUrl" TEXT,
ADD COLUMN "ocrEngine" TEXT,
ADD COLUMN "ocrProcessedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "assistant_attachment_searchableStorageKey_key"
ON "assistant_attachment"("searchableStorageKey");
