import { prisma } from "@/lib/prisma";
import type { ProjectRole } from "@prisma/client";

export class PermissionError extends Error {}

export type ProjectCapability =
  | "VIEW_PROJECT"
  | "MANAGE_PROJECT"
  | "EDIT_SCHEDULE"
  | "RESOLVE_ROADBLOCKS"
  | "COMMIT_ANY_TASK"
  | "REVIEW_SCHEDULE_IMPACTS"
  | "SUBMIT_FIELD_ITEMS"
  | "UPLOAD_PROJECT_FILES";

const ALL_PROJECT_ROLES: readonly ProjectRole[] = [
  "PROJECT_MANAGER",
  "SCHEDULER",
  "SUPERINTENDENT",
  "TRADE",
];
const GC_SIDE_ROLES: readonly ProjectRole[] = ["PROJECT_MANAGER", "SCHEDULER", "SUPERINTENDENT"];
const FIELD_CONTROL_ROLES: readonly ProjectRole[] = ["PROJECT_MANAGER", "SUPERINTENDENT"];

export const PROJECT_CAPABILITY_ROLES: Readonly<Record<ProjectCapability, readonly ProjectRole[]>> = {
  VIEW_PROJECT: ALL_PROJECT_ROLES,
  MANAGE_PROJECT: ["PROJECT_MANAGER"],
  EDIT_SCHEDULE: GC_SIDE_ROLES,
  RESOLVE_ROADBLOCKS: FIELD_CONTROL_ROLES,
  COMMIT_ANY_TASK: FIELD_CONTROL_ROLES,
  REVIEW_SCHEDULE_IMPACTS: FIELD_CONTROL_ROLES,
  SUBMIT_FIELD_ITEMS: ALL_PROJECT_ROLES,
  UPLOAD_PROJECT_FILES: ALL_PROJECT_ROLES,
};

export function hasProjectCapability(role: ProjectRole, capability: ProjectCapability): boolean {
  return PROJECT_CAPABILITY_ROLES[capability].includes(role);
}

/** Pure UI-gating helpers (no DB access) — use when the role is already known. */
export function isProjectManager(role: ProjectRole): boolean {
  return hasProjectCapability(role, "MANAGE_PROJECT");
}

export function canManageSchedule(role: ProjectRole): boolean {
  return hasProjectCapability(role, "EDIT_SCHEDULE");
}

export function canResolveRoadblocks(role: ProjectRole): boolean {
  return hasProjectCapability(role, "RESOLVE_ROADBLOCKS");
}

/** Returns the user's organization membership, or null when access was removed. */
export async function getOrganizationMembership(userId: string, organizationId: string) {
  return prisma.member.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

/** Every organization-scoped Agent operation must pass this guard first. */
export async function requireOrganizationMember(userId: string, organizationId: string) {
  const membership = await getOrganizationMembership(userId, organizationId);
  if (!membership) throw new PermissionError("You do not have access to this organization");
  return membership;
}

/**
 * Returns the current user's role on a project, or null if they aren't a member.
 */
export async function getProjectRole(userId: string, projectId: string): Promise<ProjectRole | null> {
  const member = await prisma.projectMember.findFirst({
    where: {
      projectId,
      userId,
      project: { organization: { members: { some: { userId } } } },
    },
    select: { role: true },
  });
  if (member?.role) return member.role;

  // Check if user is an owner or admin of the organization holding this project
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  });
  if (project) {
    const orgMembership = await prisma.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId,
        },
      },
    });
    if (orgMembership && (orgMembership.role === "owner" || orgMembership.role === "admin")) {
      try {
        await prisma.projectMember.upsert({
          where: { projectId_userId: { projectId, userId } },
          create: { projectId, userId, role: "PROJECT_MANAGER" },
          update: {},
        });
        return "PROJECT_MANAGER";
      } catch {
        return "PROJECT_MANAGER";
      }
    }
  }

  return null;
}

/**
 * Throws if the user is not a member of the project. Returns their role otherwise.
 */
export async function requireProjectMember(userId: string, projectId: string): Promise<ProjectRole> {
  const role = await getProjectRole(userId, projectId);
  if (!role) throw new PermissionError("You are not a member of this project");
  return role;
}

/**
 * Project-level administration: archive/unarchive the project, invite/remove members.
 * Project Manager only.
 */
export async function requireProjectManager(userId: string, projectId: string): Promise<ProjectRole> {
  const role = await requireProjectMember(userId, projectId);
  if (!hasProjectCapability(role, "MANAGE_PROJECT")) {
    throw new PermissionError("Only a Project Manager can perform this action");
  }
  return role;
}

/**
 * Master Schedule management: create/edit/delete tasks, dates, dependencies.
 * Project Manager, Scheduler, or Superintendent (any GC-side role).
 */
export async function requireScheduleEditAccess(userId: string, projectId: string): Promise<ProjectRole> {
  const role = await requireProjectMember(userId, projectId);
  if (!hasProjectCapability(role, "EDIT_SCHEDULE")) {
    throw new PermissionError("Only a Project Manager, Scheduler, or Superintendent can edit the schedule");
  }
  return role;
}

/**
 * Loads a task and verifies the current user may edit it: any GC-side role
 * (Project Manager, Scheduler, Superintendent), or the ProjectMember the task
 * is assigned to. Throws otherwise.
 */
export async function requireTaskEditAccess(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedTo: true },
  });
  if (!task) throw new PermissionError("Task not found");

  const role = await requireProjectMember(userId, task.projectId);
  const isAssignedTrade = task.assignedTo?.userId === userId;

  if (!hasProjectCapability(role, "EDIT_SCHEDULE") && !isAssignedTrade) {
    throw new PermissionError("Not authorized to edit this task");
  }

  return task;
}

/**
 * Weekly Work Plan commitments: Project Manager or Superintendent can commit any
 * task on behalf of the team; a Trade partner can commit their own assigned task.
 * Scheduler has no commit access (matches the approved capability matrix).
 */
export async function requireCommitAccess(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedTo: true },
  });
  if (!task) throw new PermissionError("Task not found");

  const role = await requireProjectMember(userId, task.projectId);
  const isAssignedTrade = task.assignedTo?.userId === userId;

  if (!hasProjectCapability(role, "COMMIT_ANY_TASK") && !isAssignedTrade) {
    throw new PermissionError("Only a Project Manager, Superintendent, or the assigned trade can commit this task");
  }

  return task;
}

/**
 * Future commitment removal is limited to the person who made the commitment,
 * or a Project Manager/Superintendent responsible for the weekly plan.
 */
export async function requireCommitmentRemovalAccess(userId: string, commitmentId: string) {
  const commitment = await prisma.weeklyCommitment.findUnique({
    where: { id: commitmentId },
    include: { task: true, committedBy: true },
  });
  if (!commitment) throw new PermissionError("Commitment not found");

  const role = await requireProjectMember(userId, commitment.task.projectId);
  const isCommitter = commitment.committedBy.userId === userId;
  if (!hasProjectCapability(role, "COMMIT_ANY_TASK") && !isCommitter) {
    throw new PermissionError(
      "Only a Project Manager, Superintendent, or the person who made the commitment can remove it"
    );
  }

  return commitment;
}

/**
 * Loads a task and verifies the current user may resolve a roadblock on it:
 * Project Manager, Superintendent, or the assigned trade partner. Schedulers
 * cannot resolve roadblocks. Throws otherwise.
 */
export async function requireRoadblockResolveAccess(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedTo: true },
  });
  if (!task) throw new PermissionError("Task not found");

  const role = await requireProjectMember(userId, task.projectId);
  const isAssignedTrade = task.assignedTo?.userId === userId;

  if (!hasProjectCapability(role, "RESOLVE_ROADBLOCKS") && !isAssignedTrade) {
    throw new PermissionError("Only a Project Manager, Superintendent, or the assigned trade can resolve this roadblock");
  }

  return task;
}

/** Rejects member IDs from another project or from users removed from the organization. */
export async function requireProjectMemberReference(projectId: string, memberId: string) {
  const member = await prisma.projectMember.findFirst({
    where: { id: memberId, projectId },
    include: { project: { select: { organizationId: true } } },
  });
  if (!member) throw new PermissionError("Selected member is not part of this project");

  const organizationMembership = await getOrganizationMembership(
    member.userId,
    member.project.organizationId
  );
  if (!organizationMembership) {
    throw new PermissionError("Selected member no longer has access to this organization");
  }
  return member;
}

/** Rejects task IDs supplied from another project. */
export async function requireProjectTaskReference(projectId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, projectId } });
  if (!task) throw new PermissionError("Selected task is not part of this project");
  return task;
}

/** Rejects dependency IDs supplied from another project. */
export async function requireProjectDependencyReference(projectId: string, dependencyId: string) {
  const dependency = await prisma.taskDependency.findFirst({
    where: {
      id: dependencyId,
      predecessor: { projectId },
      successor: { projectId },
    },
    include: { predecessor: true, successor: true },
  });
  if (!dependency) throw new PermissionError("Dependency is not part of this project");
  return dependency;
}
