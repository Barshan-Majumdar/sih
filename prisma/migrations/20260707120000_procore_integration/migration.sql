-- CreateEnum
CREATE TYPE "IntegrationSource" AS ENUM ('NATIVE', 'PROCORE');

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "procoreProjectId" TEXT;

-- AlterTable
ALTER TABLE "rfi" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "source" "IntegrationSource" NOT NULL DEFAULT 'NATIVE';

-- AlterTable
ALTER TABLE "submittal" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "source" "IntegrationSource" NOT NULL DEFAULT 'NATIVE';

-- CreateTable
CREATE TABLE "procore_connection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "procoreCompanyId" TEXT NOT NULL,
    "procoreCompanyName" TEXT,
    "connectedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "procore_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procore_connection_organizationId_key" ON "procore_connection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "rfi_projectId_source_externalId_key" ON "rfi"("projectId", "source", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "submittal_projectId_source_externalId_key" ON "submittal"("projectId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "procore_connection" ADD CONSTRAINT "procore_connection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
