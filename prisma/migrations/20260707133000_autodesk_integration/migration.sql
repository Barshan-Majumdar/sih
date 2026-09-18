-- AlterEnum
ALTER TYPE "IntegrationSource" ADD VALUE 'AUTODESK';

-- AlterTable
ALTER TABLE "drawing" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "source" "IntegrationSource" NOT NULL DEFAULT 'NATIVE';

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "autodeskProjectId" TEXT;

-- CreateTable
CREATE TABLE "autodesk_connection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "accessTokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "autodeskHubId" TEXT NOT NULL,
    "autodeskHubName" TEXT,
    "connectedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "autodesk_connection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "autodesk_connection_organizationId_key" ON "autodesk_connection"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "drawing_projectId_source_externalId_key" ON "drawing"("projectId", "source", "externalId");

-- AddForeignKey
ALTER TABLE "autodesk_connection" ADD CONSTRAINT "autodesk_connection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
