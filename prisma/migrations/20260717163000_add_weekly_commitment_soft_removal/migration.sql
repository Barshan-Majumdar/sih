ALTER TABLE "weekly_commitment"
ADD COLUMN "removedAt" TIMESTAMP(3),
ADD COLUMN "removedById" TEXT,
ADD COLUMN "removalReason" TEXT;

ALTER TABLE "weekly_commitment"
ADD CONSTRAINT "weekly_commitment_removedById_fkey"
FOREIGN KEY ("removedById") REFERENCES "user"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "weekly_commitment_removedAt_idx" ON "weekly_commitment"("removedAt");
