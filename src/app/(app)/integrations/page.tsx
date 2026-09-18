import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { canUseIntegrations } from "@/lib/plans";
import { isProcoreConfigured } from "@/lib/procore";
import { fetchProcoreProjectsForOrg } from "@/app/actions/procore";
import { ProcoreIntegrationPanel } from "@/components/ProcoreIntegrationPanel";
import { Card } from "@/components/ui/Card";
import { AppPageHeader } from "@/components/PageHeader";

export default async function IntegrationsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { user, organizationId } = await requireActiveOrganization();
  const params = await searchParams;

  const [org, membership, procoreConnection] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.member.findUnique({
      where: { organizationId_userId: { organizationId, userId: user.id } },
    }),
    prisma.procoreConnection.findUnique({ where: { organizationId } }),
  ]);

  const isOwner = membership?.role === "owner";
  const isProPlan = canUseIntegrations(org.planTier);
  const projects = isOwner
    ? await prisma.project.findMany({
        where: { organizationId, isArchived: false },
        select: { id: true, name: true, procoreProjectId: true },
        orderBy: { name: "asc" },
      })
    : [];
  const procoreProjects =
    procoreConnection && isOwner && isProPlan ? await fetchProcoreProjectsForOrg(organizationId) : [];

  return (
    <div className="app-page app-page-narrow">
      <AppPageHeader
        eyebrow="Organization"
        title="Integrations"
        description={`Connect ${org.name} to the systems your project teams already use.`}
      />

      {params.connected && (
        <Card className="p-4 mb-6 border-success/40 bg-success/5">
          <p className="text-sm text-success font-medium">Procore connected successfully.</p>
        </Card>
      )}

      {params.error && (
        <Card className="p-4 mb-6 border-error/40 bg-error/5">
          <p className="text-sm text-error font-medium">{decodeURIComponent(params.error)}</p>
        </Card>
      )}

      <div className="space-y-6">
        <ProcoreIntegrationPanel
          isConfigured={isProcoreConfigured()}
          isProPlan={isProPlan}
          isOwner={isOwner}
          isConnected={!!procoreConnection}
          companyName={procoreConnection?.procoreCompanyName ?? null}
          projects={projects}
          procoreProjects={procoreProjects}
        />

        <Card className="p-6 opacity-90">
          <div className="flex items-start justify-between gap-4 mb-2">
            <h2 className="app-card-title">Autodesk Construction Cloud</h2>
            <span className="shrink-0 rounded-full bg-surface-soft px-2.5 py-0.5 text-xs font-medium text-muted">
              Coming soon
            </span>
          </div>
          <p className="text-sm text-muted">
            Pull PDF drawings from ACC into your project Drawings log — same one-way sync pattern as Procore.
            Backend support is built; we&apos;re waiting on broader APS developer access before enabling connect in the UI.
          </p>
          <p className="text-xs text-muted-soft mt-3">
            Until then, upload drawings manually on any project&apos;s{" "}
            <Link href="/projects" className="underline hover:text-ink">
              Drawings
            </Link>{" "}
            tab. Included on the{" "}
            <Link href="/pricing" className="underline hover:text-ink">
              Pro
            </Link>{" "}
            plan when live.
          </p>
        </Card>
      </div>
    </div>
  );
}
