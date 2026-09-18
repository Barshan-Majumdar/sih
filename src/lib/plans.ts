import { prisma } from "@/lib/prisma";
import type { PlanTier } from "@prisma/client";

/**
 * Plan tier product rules. There is no self-serve checkout; an organization's
 * planTier is set directly by an operator, but the limits below are product
 * behavior and always apply.
 */

/** Product limits per tier. null = unlimited. */
export const PLAN_LIMITS: Record<PlanTier, { activeProjects: number | null; label: string }> = {
  FREE: { activeProjects: 2, label: "Free" },
  CORE: { activeProjects: null, label: "Core" },
  PRO: { activeProjects: null, label: "Pro" },
};

/**
 * Pure limit check, separated for unit testing: can this org create another
 * active project on its tier?
 */
export function canCreateProject(tier: PlanTier, currentActiveProjects: number): boolean {
  const limit = PLAN_LIMITS[tier].activeProjects;
  return limit === null || currentActiveProjects < limit;
}

export async function assertCanCreateProject(organizationId: string): Promise<void> {
  const [org, activeCount] = await Promise.all([
    prisma.organization.findUniqueOrThrow({
      where: { id: organizationId },
      select: { planTier: true },
    }),
    prisma.project.count({ where: { organizationId, isArchived: false } }),
  ]);

  if (!canCreateProject(org.planTier, activeCount)) {
    const limit = PLAN_LIMITS[org.planTier].activeProjects;
    throw new Error(
      `The ${PLAN_LIMITS[org.planTier].label} plan allows ${limit} active project${limit === 1 ? "" : "s"}. ` +
        `Archive a project or contact your organization owner to raise the limit.`
    );
  }
}

/** Procore and Autodesk integrations are Pro-tier features. */
export function canUseIntegrations(tier: PlanTier): boolean {
  return tier === "PRO";
}
