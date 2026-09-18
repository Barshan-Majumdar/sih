CREATE TABLE "assistant_attachment" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "projectId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_attachment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_attachment_storageKey_key" ON "assistant_attachment"("storageKey");
CREATE INDEX "assistant_attachment_conversationId_createdAt_idx" ON "assistant_attachment"("conversationId", "createdAt");
CREATE INDEX "assistant_attachment_messageId_idx" ON "assistant_attachment"("messageId");
CREATE INDEX "assistant_attachment_projectId_idx" ON "assistant_attachment"("projectId");

ALTER TABLE "assistant_attachment" ADD CONSTRAINT "assistant_attachment_conversationId_fkey"
FOREIGN KEY ("conversationId") REFERENCES "assistant_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_attachment" ADD CONSTRAINT "assistant_attachment_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "assistant_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "assistant_attachment" ADD CONSTRAINT "assistant_attachment_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "assistant_attachment" ADD CONSTRAINT "assistant_attachment_uploadedById_fkey"
FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
