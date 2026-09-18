-- Add task create/update proposals and percent-complete tracking.
ALTER TYPE "AssistantActionKind" ADD VALUE 'TASK_CHANGE';

ALTER TABLE "assistant_action_proposal" ALTER COLUMN "taskId" DROP NOT NULL;

ALTER TABLE "task" ADD COLUMN "progress" INTEGER NOT NULL DEFAULT 0;
UPDATE "task" SET "progress" = 100 WHERE "status" = 'DONE';
ALTER TABLE "task" ADD CONSTRAINT "task_progress_range" CHECK ("progress" BETWEEN 0 AND 100);
