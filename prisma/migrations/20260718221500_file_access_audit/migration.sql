CREATE TYPE "FileAccessAction" AS ENUM ('VIEW', 'DOWNLOAD');
CREATE TYPE "FileAccessOutcome" AS ENUM ('ALLOWED', 'DENIED');

CREATE TABLE "file_access_audit_entry" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "projectId" TEXT,
  "projectName" TEXT NOT NULL,
  "userId" TEXT,
  "userName" TEXT,
  "storageKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "action" "FileAccessAction" NOT NULL,
  "outcome" "FileAccessOutcome" NOT NULL,
  "rangeRequested" BOOLEAN NOT NULL DEFAULT false,
  "userAgent" TEXT,
  "denialReason" TEXT,
  "dedupeKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "file_access_audit_entry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "file_access_audit_entry_dedupeKey_key"
ON "file_access_audit_entry"("dedupeKey");
CREATE INDEX "file_access_audit_entry_projectId_createdAt_idx"
ON "file_access_audit_entry"("projectId", "createdAt");
CREATE INDEX "file_access_audit_entry_organizationId_createdAt_idx"
ON "file_access_audit_entry"("organizationId", "createdAt");
CREATE INDEX "file_access_audit_entry_userId_createdAt_idx"
ON "file_access_audit_entry"("userId", "createdAt");

ALTER TABLE "file_access_audit_entry"
ADD CONSTRAINT "file_access_audit_entry_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "file_access_audit_entry"
ADD CONSTRAINT "file_access_audit_entry_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "project"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "file_access_audit_entry"
ADD CONSTRAINT "file_access_audit_entry_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "user"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
