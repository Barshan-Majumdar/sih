import Link from "next/link";
import { daysBetween, formatDate } from "@/lib/utils";
import { Calendar, Clock } from "lucide-react";

export type PortfolioTimelineProject = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  percentComplete: number;
  healthScore: number | null;
};

function barColor(healthScore: number | null): string {
  if (healthScore === null) return "bg-surface-strong";
  if (healthScore >= 80) return "bg-success";
  if (healthScore >= 50) return "bg-brand-accent";
  return "bg-error";
}

export function PortfolioTimelineChart({ projects }: { projects: PortfolioTimelineProject[] }) {
  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-canvas p-12 text-center shadow-card">
        <Calendar className="mx-auto h-8 w-8 text-muted mb-2" />
        <p className="app-empty-title text-sm">No active projects to display yet</p>
        <p className="text-xs text-muted mt-1">Active project timelines will appear here once projects are created.</p>
      </div>
    );
  }

  const rangeStart = new Date(Math.min(...projects.map((p) => p.startDate.getTime())));
  const rangeEnd = new Date(Math.max(...projects.map((p) => p.endDate.getTime())));
  const totalDays = Math.max(daysBetween(rangeStart, rangeEnd), 1);
  const today = new Date();
  const todayOffsetPct = Math.min(100, Math.max(0, (daysBetween(rangeStart, today) / totalDays) * 100));
  const showTodayMarker = today >= rangeStart && today <= rangeEnd;

  return (
    <div className="rounded-2xl border border-hairline bg-surface-card shadow-card overflow-hidden">
      <div className="flex border-b border-hairline bg-surface-soft text-xs text-muted font-medium">
        <div className="w-64 shrink-0 px-4 py-3 border-r border-hairline">Project Workspace</div>
        <div className="flex flex-1 justify-between px-4 py-3 font-mono">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted" /> {formatDate(rangeStart)}
          </span>
          <span className="text-muted-soft font-normal text-[11px]">Timeline scale</span>
          <span className="inline-flex items-center gap-1">
            {formatDate(rangeEnd)} <Clock className="h-3 w-3 text-muted" />
          </span>
        </div>
      </div>

      <div className="relative divide-y divide-hairline-soft">
        {showTodayMarker && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-error z-10 pointer-events-none"
            style={{ left: `calc(16rem + ${todayOffsetPct}% * (100% - 16rem) / 100)` }}
            title={`Today: ${formatDate(today)}`}
          />
        )}
        {projects.map((project) => {
          const offsetDays = Math.max(daysBetween(rangeStart, project.startDate), 0);
          const durationDays = Math.max(daysBetween(project.startDate, project.endDate), 1);
          const leftPct = (offsetDays / totalDays) * 100;
          const widthPct = Math.min((durationDays / totalDays) * 100, 100 - leftPct);

          return (
            <div key={project.id} className="flex items-center transition-colors hover:bg-surface-soft/40">
              <div className="w-64 shrink-0 px-4 py-3 text-sm border-r border-hairline">
                <Link
                  href={`/dashboard/${project.id}`}
                  className="font-semibold text-ink hover:text-brand-accent transition-colors truncate block"
                >
                  {project.name}
                </Link>
                <div className="text-xs text-muted font-mono mt-0.5">{project.percentComplete}% complete</div>
              </div>
              <div className="flex-1 relative h-12 px-4">
                <div className="absolute inset-y-0 my-auto h-6" style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 1)}%` }}>
                  <div
                    className={`h-full rounded-lg ${barColor(project.healthScore)} shadow-sm transition-all hover:brightness-105 flex items-center px-2 min-w-[6px]`}
                    title={`${formatDate(project.startDate)} – ${formatDate(project.endDate)}${
                      project.healthScore !== null ? ` · Health ${project.healthScore}` : ""
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between border-t border-hairline bg-surface-soft/40 px-5 py-3 text-xs text-muted gap-2">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-success" /> Healthy (80+)
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-brand-accent" /> At risk (50–79)
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-error" /> Struggling (&lt;50)
          </span>
        </div>
        {showTodayMarker && (
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
            <span className="inline-block h-2 w-0.5 bg-error" /> Today&apos;s date indicator
          </span>
        )}
      </div>
    </div>
  );
}
