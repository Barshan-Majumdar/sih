import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveOrganization } from "@/lib/session";
import { Card } from "@/components/ui/Card";
import { AppPageHeader } from "@/components/PageHeader";
import { formatDate, calculateMeanProgress } from "@/lib/utils";

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
    include: { tasks: { select: { progress: true, status: true } } },
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
            const completion = calculateMeanProgress(project.tasks);
            return (
              <div key={project.id} className="group relative flex h-full flex-col">
                <Link href={`/dashboard/${project.id}`} className="block focus-visible:outline-none flex-1">
                  <Card className="flex h-full min-h-48 flex-col p-5 transition-all duration-200 ease-out group-hover:-translate-y-1 group-hover:border-hairline-strong group-hover:shadow-card-hover group-focus-visible:ring-2 group-focus-visible:ring-brand-accent">
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ink text-sm font-bold text-canvas shadow-[0_2px_8px_rgba(15,23,42,0.14)] transition-transform group-hover:scale-105">
                        {project.name.charAt(0).toUpperCase()}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-pill border border-hairline/80 bg-surface-soft px-2.5 py-0.5 text-xs font-semibold text-muted transition-colors group-hover:border-brand-accent/30 group-hover:text-ink">
                        <span>Dashboard</span>
                        <span className="text-brand-accent transition-transform group-hover:translate-x-0.5" aria-hidden>&rarr;</span>
                      </span>
                    </div>
                    <h2 className="app-card-title mb-1.5 line-clamp-1 group-hover:text-brand-accent transition-colors">{project.name}</h2>
                    <p className="mb-5 text-xs text-muted">
                      {formatDate(project.startDate)} &ndash; {formatDate(project.endDate)}
                    </p>
                    <div className="mt-auto">
                      <div className="mb-2 flex items-center justify-between text-xs font-medium">
                        <span className="text-muted">{total} {total === 1 ? "task" : "tasks"}</span>
                        <span className="font-semibold text-ink tabular-nums">{completion}% complete</span>
                      </div>
                      <div className="app-progress">
                        <span
                          style={{ width: `${completion}%` }}
                          className={`${completion === 100 ? "bg-success" : completion > 0 ? "bg-brand-accent" : "bg-muted-soft"} transition-all duration-500`}
                        />
                      </div>
                    </div>
                  </Card>
                </Link>
                {/* Clean Quick Access Links */}
                <div className="mt-2 flex items-center gap-1.5 px-1 text-xs">
                  <Link
                    href={`/gantt/${project.id}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted hover:bg-surface-soft hover:text-ink transition-colors"
                  >
                    <span>Gantt</span>
                  </Link>
                  <span className="text-hairline-soft" aria-hidden>&bull;</span>
                  <Link
                    href={`/tasks/${project.id}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted hover:bg-surface-soft hover:text-ink transition-colors"
                  >
                    <span>Tasks</span>
                  </Link>
                  <span className="text-hairline-soft" aria-hidden>&bull;</span>
                  <Link
                    href={`/field-intake/${project.id}`}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted hover:bg-surface-soft hover:text-ink transition-colors"
                  >
                    <span>Field Intake</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
