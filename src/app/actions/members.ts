"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireProjectManager } from "@/lib/permissions";
import { generateInviteExpiry } from "@/lib/utils";
import { activityChanges, logActivity } from "@/lib/activity-log";
import { ok, fail, projectRoleSchema, type ActionResult } from "./schemas";
import type { ProjectInvite, ProjectMember } from "@prisma/client";

const createInviteSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  role: projectRoleSchema,
});

export async function createInvite(input: unknown): Promise<ActionResult<ProjectInvite>> {
  const parsed = createInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireProjectManager(user.id, parsed.data.projectId);

    const invite = await prisma.projectInvite.create({
      data: {
        projectId: parsed.data.projectId,
        role: parsed.data.role,
        expiresAt: generateInviteExpiry(),
      },
    });

    await logActivity({
      projectId: parsed.data.projectId,
      userId: user.id,
      action: "project_invite_created",
      detail: `Created a ${parsed.data.role.replaceAll("_", " ").toLowerCase()} project invitation`,
      entityType: "PROJECT_INVITE",
      entityId: invite.id,
      changes: activityChanges({}, invite, ["role", "expiresAt"]),
    });

    revalidatePath(`/projects/${parsed.data.projectId}/members`);
    return ok(invite);
  } catch (error) {
    return fail(error);
  }
}

const acceptInviteSchema = z.object({
  token: z.string().min(1, "A valid invite token is required"),
});

export async function acceptInvite(input: unknown): Promise<ActionResult<ProjectMember>> {
  const parsed = acceptInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();

    const invite = await prisma.projectInvite.findUnique({
      where: { token: parsed.data.token },
      include: { project: true },
    });

    if (!invite) throw new Error("This invite link is invalid");
    if (invite.usedAt) throw new Error("This invite link has already been used");
    if (invite.expiresAt < new Date()) throw new Error("This invite link has expired");

    const [member] = await prisma.$transaction(async (tx) => {
      await tx.member.upsert({
        where: {
          organizationId_userId: {
            organizationId: invite.project.organizationId,
            userId: user.id,
          },
        },
        create: {
          organizationId: invite.project.organizationId,
          userId: user.id,
          role: "member",
        },
        update: {},
      });

      const projectMember = await tx.projectMember.upsert({
        where: { projectId_userId: { projectId: invite.projectId, userId: user.id } },
        create: { projectId: invite.projectId, userId: user.id, role: invite.role },
        update: { role: invite.role },
      });

      await tx.projectInvite.update({
        where: { id: invite.id },
        data: { usedAt: new Date() },
      });

      return [projectMember];
    });


    await logActivity({
      projectId: invite.projectId,
      userId: user.id,
      action: "project_member_joined",
      detail: `Joined the project as ${member.role.replaceAll("_", " ").toLowerCase()}`,
      entityType: "PROJECT_MEMBER",
      entityId: member.id,
      changes: activityChanges({}, member, ["userId", "role"]),
    });

    revalidatePath(`/projects/${invite.projectId}`);
    revalidatePath(`/projects/${invite.projectId}/members`);
    return ok(member);
  } catch (error) {
    return fail(error);
  }
}

const removeMemberSchema = z.object({
  projectId: z.string().min(1, "projectId is required"),
  memberId: z.string().min(1, "memberId is required"),
});

export async function removeMember(input: unknown): Promise<ActionResult<null>> {
  const parsed = removeMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await requireProjectManager(user.id, parsed.data.projectId);

    const removedMember = await prisma.$transaction(async (tx) => {
      const member = await tx.projectMember.findFirst({
        where: { id: parsed.data.memberId, projectId: parsed.data.projectId },
        include: { user: { select: { name: true } } },
      });
      if (!member) throw new Error("Member not found on this project");

      if (member.role === "PROJECT_MANAGER") {
        const managerCount = await tx.projectMember.count({
          where: { projectId: parsed.data.projectId, role: "PROJECT_MANAGER" },
        });
        if (managerCount <= 1) {
          throw new Error("A project must keep at least one Project Manager");
        }
      }

      // onDelete: SetNull on Task.assignedToId automatically unassigns their tasks.
      await tx.projectMember.delete({ where: { id: member.id } });
      return member;
    });

    await logActivity({
      projectId: parsed.data.projectId,
      userId: user.id,
      action: "project_member_removed",
      detail: `Removed ${removedMember.user.name} from the project`,
      entityType: "PROJECT_MEMBER",
      entityId: removedMember.id,
      changes: activityChanges(removedMember, {}, ["userId", "role"]),
    });

    revalidatePath(`/projects/${parsed.data.projectId}/members`);
    revalidatePath(`/projects/${parsed.data.projectId}`);
    return ok(null);
  } catch (error) {
    return fail(error);
  }
}
