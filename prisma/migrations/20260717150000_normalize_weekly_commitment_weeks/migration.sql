-- Canonicalize historical week starts to Monday at noon UTC. Earlier app
-- versions could store local Monday midnight while AI actions stored noon UTC.
-- Keep the most recently updated row if both representations exist.
WITH ranked_commitments AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY
        "taskId",
        DATE_TRUNC('week', "weekStartDate" + INTERVAL '36 hours')
      ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
    ) AS row_number
  FROM "weekly_commitment"
)
DELETE FROM "weekly_commitment" AS commitment
USING ranked_commitments AS ranked
WHERE commitment."id" = ranked."id"
  AND ranked.row_number > 1;

UPDATE "weekly_commitment"
SET "weekStartDate" =
  DATE_TRUNC('week', "weekStartDate" + INTERVAL '36 hours') + INTERVAL '12 hours'
WHERE "weekStartDate" !=
  DATE_TRUNC('week', "weekStartDate" + INTERVAL '36 hours') + INTERVAL '12 hours';
