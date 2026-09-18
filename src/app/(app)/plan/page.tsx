import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { PLAN_LIMITS } from "@/lib/plans";
import { Card } from "@/components/ui/Card";
import { AppPageHeader } from "@/components/PageHeader";

export default async function PlanPage() {
  const { organizationId } = await requireActiveOrganization();

  const [org, activeProjects] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.project.count({ where: { organizationId, isArchived: false } }),
  ]);

  const limits = PLAN_LIMITS[org.planTier];

  return (
    <div className="app-page app-page-narrow">
      <AppPageHeader eyebrow="Organization" title="Plan and usage" description={`${org.name} plan and project usage.`} />

      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="app-metric-label">Current plan</p>
            <p className="app-metric-value text-2xl">{limits.label}</p>
          </div>
          <div className="text-right">
            <p className="app-metric-label">Active projects</p>
            <p className="app-metric-value text-2xl">
              {activeProjects}
              <span className="text-sm text-muted-soft font-normal">
                {" "}/ {limits.activeProjects ?? "∞"}
              </span>
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="app-section-title mb-2">Plan limits</h2>
        <p className="text-sm text-muted">
          The <strong>{limits.label}</strong> plan allows{" "}
          {limits.activeProjects === null ? "unlimited active projects" : `up to ${limits.activeProjects} active projects`}.
          Plan changes are handled by your organization owner, not from this page. See what each plan includes on the{" "}
          <Link href="/pricing" className="underline hover:text-ink">
            pricing page
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
