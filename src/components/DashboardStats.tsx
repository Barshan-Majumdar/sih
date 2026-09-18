import { Card } from "@/components/ui/Card";

export function DashboardStats({
  totalTasks,
  percentComplete,
  openRoadblocks,
}: {
  totalTasks: number;
  percentComplete: number;
  openRoadblocks: number;
}) {
  if (totalTasks === 0) {
    return (
      <Card className="border-dashed p-10 text-center">
        <p className="app-empty-title">Project analytics will appear here</p>
        <p className="mt-2 text-sm text-muted">Add schedule activities on the Tasks tab to begin measuring progress.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="relative overflow-hidden p-5">
        <span className="absolute inset-x-0 top-0 h-0.5 bg-ink" />
        <p className="app-metric-label">Total tasks</p>
        <p className="app-metric-value">{totalTasks}</p>
        <p className="app-metric-helper">In the master schedule</p>
      </Card>
      <Card className="relative overflow-hidden p-5">
        <span className="absolute inset-x-0 top-0 h-0.5 bg-brand-accent" />
        <p className="app-metric-label">Schedule complete</p>
        <p className="app-metric-value">{percentComplete}%</p>
        <div className="app-progress mt-4">
          <span style={{ width: `${percentComplete}%` }} />
        </div>
      </Card>
      <Card className="relative overflow-hidden p-5">
        <span className={`absolute inset-x-0 top-0 h-0.5 ${openRoadblocks > 0 ? "bg-error" : "bg-success"}`} />
        <p className="app-metric-label">Open roadblocks</p>
        <p className={`app-metric-value ${openRoadblocks > 0 ? "text-error" : "text-success"}`}>
          {openRoadblocks}
        </p>
        <p className="app-metric-helper">Blocking current work</p>
      </Card>
    </div>
  );
}
