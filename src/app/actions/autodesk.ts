"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireActiveOrganization } from "@/lib/session";
import { canUseIntegrations } from "@/lib/plans";
import { getAutodeskConnectionForOrg } from "@/lib/autodesk-connection";
import {
  buildAutodeskAuthorizeUrl,
  exchangeAutodeskCode,
  isAutodeskConfigured,
  listAutodeskHubs,
  listAutodeskProjects,
  listAutodeskDrawingFiles,
  downloadAutodeskItem,
  tokenExpiresAt,
} from "@/lib/autodesk";
import { autodeskDrawingTitle, autodeskDisciplineFromName } from "@/lib/autodesk-sync";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { uploadFile, buildStorageKey, deleteStoredFile } from "@/lib/storage";
import { enforceUploadQuota, validateUploadBytes } from "@/lib/file-uploads";
import { ok, fail, type ActionResult } from "./schemas";

const OAUTH_STATE_COOKIE = "autodesk_oauth_state";
const OAUTH_ORG_COOKIE = "autodesk_oauth_org";

async function requireOrgOwner(userId: string, organizationId: string) {
  const membership = await prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
  if (!membership || membership.role !== "owner") {
    throw new Error("Only the organization owner can manage integrations");
  }
}

async function requireProTier(organizationId: string) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { planTier: true },
  });
  if (!canUseIntegrations(org.planTier)) {
    throw new Error("Autodesk integration requires the Pro plan. Upgrade on the Billing page.");
  }
}

async function defaultProjectMemberId(projectId: string): Promise<string> {
  const pm = await prisma.projectMember.findFirst({
    where: { projectId, role: "PROJECT_MANAGER" },
    select: { id: true },
  });
  if (pm) return pm.id;
  const any = await prisma.projectMember.findFirst({
    where: { projectId },
    select: { id: true },
  });
  if (!any) throw new Error("Project has no members to attribute synced records to");
  return any.id;
}

export async function startAutodeskConnect(): Promise<never> {
  if (!isAutodeskConfigured()) throw new Error("Autodesk isn't configured on this server");
  const { user, organizationId } = await requireActiveOrganization();
  await requireOrgOwner(user.id, organizationId);
  await requireProTier(organizationId);

  const state = crypto.randomUUID();
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  jar.set(OAUTH_ORG_COOKIE, organizationId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });

  redirect(buildAutodeskAuthorizeUrl(state));
}

export async function completeAutodeskOAuth(code: string, state: string): Promise<{ organizationId: string }> {
  const jar = await cookies();
  const expectedState = jar.get(OAUTH_STATE_COOKIE)?.value;
  const organizationId = jar.get(OAUTH_ORG_COOKIE)?.value;
  jar.delete(OAUTH_STATE_COOKIE);
  jar.delete(OAUTH_ORG_COOKIE);

  if (!expectedState || !organizationId || expectedState !== state) {
    throw new Error("Invalid or expired Autodesk OAuth state");
  }

  const user = await requireUser();
  await requireOrgOwner(user.id, organizationId);
  await requireProTier(organizationId);

  const tokens = await exchangeAutodeskCode(code);
  const hubs = await listAutodeskHubs(tokens.access_token);
  if (hubs.length === 0) throw new Error("No ACC/BIM 360 hubs found for this account");

  const hub = hubs[0];
  await prisma.autodeskConnection.upsert({
    where: { organizationId },
    create: {
      organizationId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: tokenExpiresAt(tokens.expires_in),
      autodeskHubId: hub.id,
      autodeskHubName: hub.attributes.name,
      connectedByUserId: user.id,
    },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      accessTokenExpiresAt: tokenExpiresAt(tokens.expires_in),
      autodeskHubId: hub.id,
      autodeskHubName: hub.attributes.name,
      connectedByUserId: user.id,
    },
  });

  revalidatePath("/integrations");
  return { organizationId };
}

export async function disconnectAutodesk(): Promise<ActionResult<null>> {
  try {
    const { user, organizationId } = await requireActiveOrganization();
    await requireOrgOwner(user.id, organizationId);
    await prisma.autodeskConnection.deleteMany({ where: { organizationId } });
    revalidatePath("/integrations");
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

const mappingSchema = z.object({
  projectId: z.string().min(1),
  autodeskProjectId: z.string().optional().nullable(),
});

export async function setAutodeskProjectMapping(input: unknown): Promise<ActionResult<null>> {
  const parsed = mappingSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const { user, organizationId } = await requireActiveOrganization();
    await requireOrgOwner(user.id, organizationId);
    await requireProTier(organizationId);

    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, organizationId },
    });
    if (!project) throw new Error("Project not found");

    await prisma.project.update({
      where: { id: project.id },
      data: { autodeskProjectId: parsed.data.autodeskProjectId?.trim() || null },
    });

    await logActivity({
      projectId: project.id,
      userId: user.id,
      action: "autodesk_mapping_changed",
      detail: parsed.data.autodeskProjectId
        ? "Mapped this project to an Autodesk Construction Cloud project"
        : "Removed the Autodesk project mapping",
      entityType: "INTEGRATION_MAPPING",
      entityId: project.id,
      source: "INTEGRATION",
      changes: activityChanges(
        { autodeskProjectId: project.autodeskProjectId },
        { autodeskProjectId: parsed.data.autodeskProjectId?.trim() || null },
        ["autodeskProjectId"]
      ),
    });

    revalidatePath("/integrations");
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}

const syncSchema = z.object({ projectId: z.string().min(1) });

export type AutodeskSyncSummary = { created: number; updated: number; skipped: number };

export async function syncAutodeskProject(input: unknown): Promise<ActionResult<AutodeskSyncSummary>> {
  const parsed = syncSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const { user, organizationId } = await requireActiveOrganization();
    await requireOrgOwner(user.id, organizationId);
    await requireProTier(organizationId);

    const connection = await getAutodeskConnectionForOrg(organizationId);
    if (!connection) throw new Error("Connect Autodesk first on the Integrations page");

    const project = await prisma.project.findFirst({
      where: { id: parsed.data.projectId, organizationId, isArchived: false },
    });
    if (!project) throw new Error("Project not found");
    if (!project.autodeskProjectId) throw new Error("Map this project to an ACC project first");

    const memberId = await defaultProjectMemberId(project.id);
    const now = new Date();
    const summary: AutodeskSyncSummary = { created: 0, updated: 0, skipped: 0 };

    const files = await listAutodeskDrawingFiles(
      connection.accessToken,
      connection.autodeskHubId,
      project.autodeskProjectId
    );

    for (const file of files) {
      try {
        const { bytes, fileName, contentType } = await downloadAutodeskItem(
          connection.accessToken,
          project.autodeskProjectId,
          file.id
        );
        const validated = validateUploadBytes({
          bytes,
          fileName,
          declaredMediaType: contentType,
          kind: "drawing",
        });
        await enforceUploadQuota({
          organizationId,
          projectId: project.id,
          upload: validated,
        });
        const title = autodeskDrawingTitle(validated.fileName);
        const externalId = file.id;
        const key = buildStorageKey(`drawings/${project.id}/acc`, validated.fileName);
        const fileUrl = await uploadFile(key, validated.bytes, validated.mediaType);

        const existing = await prisma.drawing.findUnique({
          where: {
            projectId_source_externalId: {
              projectId: project.id,
              source: "AUTODESK",
              externalId,
            },
          },
        });

        try {
          if (existing) {
            await prisma.$transaction(async (tx) => {
              await tx.drawing.update({
                where: { id: existing.id },
                data: { isSuperseded: true },
              });
              await tx.drawing.create({
                data: {
                  projectId: project.id,
                  title,
                  discipline: autodeskDisciplineFromName(validated.fileName),
                  fileUrl,
                  storageKey: key,
                  fileName: validated.fileName,
                  mediaType: validated.mediaType,
                  sizeBytes: validated.sizeBytes,
                  contentHash: validated.contentHash,
                  revision: existing.revision + 1,
                  uploadedById: memberId,
                  source: "AUTODESK",
                  externalId,
                  lastSyncedAt: now,
                },
              });
            });
            summary.updated++;
          } else {
            await prisma.drawing.create({
              data: {
                projectId: project.id,
                title,
                discipline: autodeskDisciplineFromName(validated.fileName),
                fileUrl,
                storageKey: key,
                fileName: validated.fileName,
                mediaType: validated.mediaType,
                sizeBytes: validated.sizeBytes,
                contentHash: validated.contentHash,
                uploadedById: memberId,
                source: "AUTODESK",
                externalId,
                lastSyncedAt: now,
              },
            });
            summary.created++;
          }
        } catch (error) {
          await deleteStoredFile(key).catch(() => undefined);
          throw error;
        }
      } catch {
        summary.skipped++;
      }
    }

    await logActivity({
      projectId: project.id,
      userId: user.id,
      action: "autodesk_synced",
      detail: `Synced ${summary.created + summary.updated} drawings from ACC (${summary.skipped} skipped)`,
      entityType: "INTEGRATION_SYNC",
      entityId: project.id,
      source: "INTEGRATION",
      changes: {
        drawingRecords: { before: null, after: summary.created + summary.updated },
        skippedRecords: { before: null, after: summary.skipped },
      },
    });

    revalidatePath(`/projects/${project.id}/drawings`);
    revalidatePath("/integrations");
    return ok(summary);
  } catch (error) {
    return fail(error);
  }
}

export async function fetchAutodeskProjectsForOrg(organizationId: string) {
  const user = await requireUser();
  await requireOrgOwner(user.id, organizationId);
  await requireProTier(organizationId);
  const connection = await getAutodeskConnectionForOrg(organizationId);
  if (!connection) return [];
  return listAutodeskProjects(connection.accessToken, connection.autodeskHubId);
}
