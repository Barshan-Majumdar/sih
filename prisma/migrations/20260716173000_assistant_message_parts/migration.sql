-- Preserve structured AI SDK message parts so tool results and citations
-- remain available when a conversation is reopened.
ALTER TABLE "assistant_message" ADD COLUMN "parts" JSONB;
