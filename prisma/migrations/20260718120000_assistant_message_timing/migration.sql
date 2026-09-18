ALTER TABLE "assistant_message"
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "durationMs" INTEGER;
