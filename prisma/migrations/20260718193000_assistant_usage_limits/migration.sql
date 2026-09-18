-- Durable Agent request counters shared by every application instance.
CREATE TABLE "assistant_usage_window" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_usage_window_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "assistant_usage_window_kind_subjectId_windowStart_key"
ON "assistant_usage_window"("kind", "subjectId", "windowStart");

CREATE INDEX "assistant_usage_window_windowStart_idx"
ON "assistant_usage_window"("windowStart");
