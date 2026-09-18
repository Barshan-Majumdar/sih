CREATE TABLE "document_chunk" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_chunk_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_chunk_documentId_pageNumber_chunkIndex_key"
ON "document_chunk"("documentId", "pageNumber", "chunkIndex");

CREATE INDEX "document_chunk_documentId_pageNumber_idx"
ON "document_chunk"("documentId", "pageNumber");

ALTER TABLE "document_chunk"
ADD CONSTRAINT "document_chunk_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "assistant_attachment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "assistant_attachment"
SET
    "extractionStatus" = 'FAILED',
    "extractionError" = 'Retry extraction to enable exact page citations.'
WHERE "extractionStatus" = 'READY'
  AND "mediaType" = 'application/pdf';
