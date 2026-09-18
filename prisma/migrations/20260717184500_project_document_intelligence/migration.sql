CREATE TYPE "ProjectFileSource" AS ENUM ('AI_UPLOAD', 'DIRECT_UPLOAD');
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED', 'UNSUPPORTED');

ALTER TABLE "assistant_attachment"
DROP CONSTRAINT "assistant_attachment_conversationId_fkey";

ALTER TABLE "assistant_attachment"
ALTER COLUMN "conversationId" DROP NOT NULL,
ADD COLUMN "source" "ProjectFileSource" NOT NULL DEFAULT 'AI_UPLOAD',
ADD COLUMN "extractionStatus" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "extractedText" TEXT,
ADD COLUMN "extractionError" TEXT,
ADD COLUMN "pageCount" INTEGER,
ADD COLUMN "processedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "assistant_attachment"
SET "extractionStatus" = CASE
  WHEN "mediaType" = 'application/pdf' THEN 'PENDING'::"DocumentProcessingStatus"
  ELSE 'UNSUPPORTED'::"DocumentProcessingStatus"
END;

ALTER TABLE "assistant_attachment"
ADD CONSTRAINT "assistant_attachment_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "assistant_conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "assistant_attachment_projectId_extractionStatus_idx"
ON "assistant_attachment"("projectId", "extractionStatus");
