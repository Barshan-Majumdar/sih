import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { OrgSubNav } from "@/components/OrgSubNav";
import { PortfolioTimelineChart } from "@/components/PortfolioTimelineChart";
import { loadProjectSummary } from "@/lib/project-summary";
import { AppPageHeader } from "@/components/PageHeader";

export default async function PortfolioTimelinePage() {
  const { user, organizationId } = await requireActiveOrganization();

  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      isArchived: false,
      members: { some: { userId: user.id } },
    },
    orderBy: { startDate: "asc" },
  });

  const timelineProjects = await Promise.all(
    projects.map(async (p) => {
      const summary = await loadProjectSummary(p.id);
      return {
        id: p.id,
        name: p.name,
        startDate: p.startDate,
        endDate: p.endDate,
        percentComplete: summary.percentComplete,
        healthScore: summary.healthScore,
      };
    })
  );

  return (
    <div className="app-page">
      <AppPageHeader
        eyebrow="Portfolio control"
        title="Project Timeline"
        description="Compare active project durations, progress, and health on one coordinated timeline."
      />

      <OrgSubNav active="Timeline" />

      <div className="mt-8">
        <PortfolioTimelineChart projects={timelineProjects} />
      </div>
    </div>
  );
}
