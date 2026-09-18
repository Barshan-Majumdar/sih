import Link from "next/link";
import { Download, Eye, History, ShieldAlert } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getProjectPageContext } from "@/lib/project-context";
import { Card } from "@/components/ui/Card";
import { ProjectPageHeader } from "@/components/PageHeader";
import { LocalDateTime } from "@/components/LocalDateTime";
import type { ActivitySource, Prisma } from "@prisma/client";

const ACTIVITY_VIEWS = [
  { value: "all", label: "All" },
  { value: "schedule", label: "Schedule" },
  { value: "field", label: "Field controls" },
  { value: "files", label: "Files" },
  { value: "team", label: "Team" },
  { value: "agent", label: "Agent" },
  { value: "integrations", label: "Integrations" },
] as const;

type ActivityView = (typeof ACTIVITY_VIEWS)[number]["value"];

const VIEW_ENTITY_TYPES: Partial<Record<ActivityView, string[]>> = {
  schedule: ["TASK", "TASK_DEPENDENCY", "WEEKLY_COMMITMENT", "BASELINE", "PULL_PLAN"],
  field: ["TASK_UPDATE", "RFI", "SUBMITTAL", "SCHEDULE_IMPACT_REQUEST"],
  files: ["PROJECT_FILE", "DRAWING"],
  team: ["PROJECT", "PROJECT_MEMBER", "PROJECT_INVITE"],
};

const SOURCE_LABELS: Record<ActivitySource, string> = {
  UI: "App",
  AGENT: "Agent",
  SYSTEM: "Automatic",
  INTEGRATION: "Integration",
};

function parseView(value: string | undefined): ActivityView {
  return ACTIVITY_VIEWS.some((view) => view.value === value) ? (value as ActivityView) : "all";
}

function formatFieldName(value: string): string {
  return value
    .replace(/Id$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function formatChangeValue(value: Prisma.JsonValue | undefined): string {
  if (value === null || value === undefined || value === "") return "Not set";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
    // Calendar/schedule values in change diffs — keep date-only to avoid TZ day shifts.
    const date = new Date(text);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  return text.length > 28 ? `${text.slice(0, 25)}...` : text;
}

function getChangeRows(changes: Prisma.JsonValue | null) {
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) return [];
  return Object.entries(changes)
    .flatMap(([field, value]) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const record = value as Prisma.JsonObject;
      return [{ field, before: record.before, after: record.after }];
    })
    .slice(0, 4);
}

export default async function ProjectActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { projectId } = await params;
  const { view: requestedView } = await searchParams;
  const view = parseView(requestedView);
  const { project } = await getProjectPageContext(projectId);

  const sourceFilter =
    view === "agent" ? "AGENT" : view === "integrations" ? "INTEGRATION" : undefined;
  const entityTypes = VIEW_ENTITY_TYPES[view];

  const [entries, fileAccessEntries] = await Promise.all([
    prisma.activityLogEntry.findMany({
      where: {
        projectId,
        ...(sourceFilter ? { source: sourceFilter } : {}),
        ...(entityTypes ? { entityType: { in: entityTypes } } : {}),
      },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    view === "all" || view === "files"
      ? prisma.fileAccessAuditEntry.findMany({
          where: { projectId },
          include: { user: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
  ]);
  const activityItems = [
    ...entries.map((entry) => ({ kind: "PROJECT" as const, entry })),
    ...fileAccessEntries.map((entry) => ({ kind: "FILE" as const, entry })),
  ]
    .sort((left, right) => right.entry.createdAt.getTime() - left.entry.createdAt.getTime())
    .slice(0, 200);

  return (
    <div className="app-page">
      <ProjectPageHeader
        projectId={projectId}
        projectName={project.name}
        title="Activity Log"
        description="A chronological record of project changes, decisions, and file access."
      />

      <nav aria-label="Activity filters" className="mt-6 overflow-x-auto border-b border-hairline-soft">
        <div className="flex min-w-max gap-6">
          {ACTIVITY_VIEWS.map((activityView) => (
            <Link
              key={activityView.value}
              href={
                activityView.value === "all"
                  ? `/projects/${projectId}/activity`
                  : `/projects/${projectId}/activity?view=${activityView.value}`
              }
              aria-current={view === activityView.value ? "page" : undefined}
              className={`border-b-2 px-0.5 pb-2 text-sm font-medium transition-colors ${
                view === activityView.value
                  ? "border-ink text-ink"
                  : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {activityView.label}
            </Link>
          ))}
        </div>
      </nav>

      <section aria-labelledby="recent-activity" className="mt-5">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="recent-activity" className="text-sm font-semibold text-ink">
              Recent activity
            </h2>
            <p className="mt-1 text-xs text-muted">
              Project changes, file views, downloads, and denied access in one timeline.
            </p>
          </div>
          <span className="text-xs tabular-nums text-muted-soft">
            {activityItems.length} recent {activityItems.length === 1 ? "event" : "events"}
          </span>
        </div>
        <Card className="p-0">
          {activityItems.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted">No activity recorded yet.</p>
          ) : (
            <ul className="divide-y divide-hairline-soft">
              {activityItems.map((item) => {
                if (item.kind === "PROJECT") {
                  const entry = item.entry;
                  return (
                    <li key={`project:${entry.id}`} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-soft text-muted">
                        <History size={15} aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-body">
                          <span className="font-medium text-ink">{entry.user.name}</span>{" "}
                          {entry.detail ?? entry.action}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                          <LocalDateTime value={entry.createdAt} />
                          <span>{SOURCE_LABELS[entry.source]}</span>
                          {entry.taskId && entry.taskName && (
                            <Link href={`/projects/${projectId}/tasks/${entry.taskId}`} className="font-medium hover:text-ink">
                              View task: {entry.taskName}
                            </Link>
                          )}
                        </div>
                        {getChangeRows(entry.changes).length > 0 && (
                          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                            {getChangeRows(entry.changes).map((change) => (
                              <div key={change.field} className="flex min-w-0 gap-1.5">
                                <dt className="font-medium text-body">{formatFieldName(change.field)}:</dt>
                                <dd className="min-w-0">
                                  {formatChangeValue(change.before)} to {formatChangeValue(change.after)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        )}
                      </div>
                    </li>
                  );
                }

                const entry = item.entry;
                const actor = entry.userName ?? entry.user?.name ?? "Unauthenticated user";
                const denied = entry.outcome === "DENIED";
                const downloaded = entry.action === "DOWNLOAD";
                const Icon = denied ? ShieldAlert : downloaded ? Download : Eye;
                return (
                  <li key={`file:${entry.id}`} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border ${
                        denied
                          ? "border-error/20 bg-error/8 text-error"
                          : "border-hairline bg-surface-soft text-muted"
                      }`}
                    >
                      <Icon size={15} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-body">
                        <span className="font-medium text-ink">{actor}</span>{" "}
                        {denied ? "was denied access to" : downloaded ? "downloaded" : "viewed"}{" "}
                        <span className="font-medium text-ink">{entry.fileName}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        <LocalDateTime value={entry.createdAt} />
                        {entry.rangeRequested ? " - ranged file request" : ""}
                        {denied && entry.denialReason ? ` - ${entry.denialReason}` : ""}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
