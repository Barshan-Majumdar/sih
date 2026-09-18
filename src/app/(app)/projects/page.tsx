import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { Card } from "@/components/ui/Card";
import { AppPageHeader } from "@/components/PageHeader";
import { formatDate, percentComplete } from "@/lib/utils";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { user, organizationId } = await requireActiveOrganization();
  const { archived } = await searchParams;
  const showArchived = archived === "true";

  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      isArchived: showArchived,
      members: { some: { userId: user.id } },
    },
    include: { tasks: { select: { status: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="app-page">
      <AppPageHeader
        eyebrow="Project directory"
        title="Projects"
        description={showArchived ? "Review projects that are no longer active." : "Open a project workspace or start a new schedule."}
        actions={
          <Link
            href="/projects/new"
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-active"
          >
            <span className="text-lg leading-none" aria-hidden>+</span>
            <span className="ml-1.5">New project</span>
          </Link>
        }
      />

      <div className="mb-6 inline-flex items-center gap-1 rounded-md border border-hairline bg-canvas p-1">
        <Link
          href="/projects"
          className={`rounded-sm px-3.5 py-1.5 text-sm font-medium transition-colors ${
            !showArchived ? "bg-ink text-canvas" : "text-muted hover:bg-surface-soft hover:text-ink"
          }`}
        >
          Active
        </Link>
        <Link
          href="/projects?archived=true"
          className={`rounded-sm px-3.5 py-1.5 text-sm font-medium transition-colors ${
            showArchived ? "bg-ink text-canvas" : "text-muted hover:bg-surface-soft hover:text-ink"
          }`}
        >
          Archived
        </Link>
      </div>

      {projects.length === 0 ? (
        <Card className="p-14 text-center">
          {showArchived ? (
            <p className="text-sm text-muted">No archived projects.</p>
          ) : (
            <>
              <h2 className="app-empty-title mb-2">No projects yet</h2>
              <p className="text-sm text-muted mb-6">
                Create your first project to start scheduling tasks and inviting your team.
              </p>
              <Link
                href="/projects/new"
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-on-primary hover:bg-primary-active transition-colors"
              >
                + Create your first project
              </Link>
            </>
          )}
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const total = project.tasks.length;
            const done = project.tasks.filter((t) => t.status === "DONE").length;
            const completion = percentComplete(total, done);
            return (
              <Link key={project.id} href={`/projects/${project.id}`} className="group">
                <Card className="flex h-full min-h-44 flex-col p-5 transition-all group-hover:-translate-y-0.5 group-hover:border-muted-soft group-hover:shadow-[0_8px_24px_rgba(17,17,17,0.08)]">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-sm font-bold text-canvas">
                      {project.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-muted transition-colors group-hover:text-ink">Open</span>
                  </div>
                  <h2 className="app-card-title mb-1">{project.name}</h2>
                  <p className="mb-5 text-xs text-muted">
                    {formatDate(project.startDate)} – {formatDate(project.endDate)}
                  </p>
                  <div className="mt-auto">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-muted">{total} tasks</span>
                      <span className="font-semibold text-ink">{completion}%</span>
                    </div>
                    <div className="app-progress">
                      <span style={{ width: `${completion}%` }} />
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
