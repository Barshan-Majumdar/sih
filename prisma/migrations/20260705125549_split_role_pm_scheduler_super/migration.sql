-- Split the GC_OWNER role into PROJECT_MANAGER, SCHEDULER, SUPERINTENDENT.
-- Existing GC_OWNER rows become PROJECT_MANAGER (closest equivalent: full admin rights).
-- TRADE is unchanged.

BEGIN;

CREATE TYPE "ProjectRole_new" AS ENUM ('PROJECT_MANAGER', 'SCHEDULER', 'SUPERINTENDENT', 'TRADE');

ALTER TABLE "project_member"
  ALTER COLUMN "role" TYPE "ProjectRole_new"
  USING (
    CASE "role"::text
      WHEN 'GC_OWNER' THEN 'PROJECT_MANAGER'
      ELSE "role"::text
    END::"ProjectRole_new"
  );

ALTER TABLE "project_invite"
  ALTER COLUMN "role" TYPE "ProjectRole_new"
  USING (
    CASE "role"::text
      WHEN 'GC_OWNER' THEN 'PROJECT_MANAGER'
      ELSE "role"::text
    END::"ProjectRole_new"
  );

DROP TYPE "ProjectRole";
ALTER TYPE "ProjectRole_new" RENAME TO "ProjectRole";

COMMIT;
