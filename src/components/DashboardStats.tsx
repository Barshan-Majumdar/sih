import { Card } from "@/components/ui/Card";
import { ListTodo, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

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
      <Card className="border-dashed p-10 text-center bg-surface-soft/40">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-surface-strong text-muted">
          <ListTodo size={20} />
        </div>
        <p className="app-empty-title">Project analytics will appear here</p>
        <p className="mt-2 text-sm text-muted">Add schedule activities on the Tasks tab to begin measuring progress.</p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card className="group relative overflow-hidden p-5 transition-all hover:border-hairline hover:shadow-card-hover">
        <span className="absolute inset-x-0 top-0 h-1 bg-ink" />
        <div className="flex items-center justify-between">
          <p className="app-metric-label">Total tasks</p>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-soft text-muted group-hover:text-ink transition-colors">
            <ListTodo size={14} />
          </span>
        </div>
        <p className="app-metric-value">{totalTasks}</p>
        <p className="app-metric-helper">In the master schedule</p>
      </Card>

      <Card className="group relative overflow-hidden p-5 transition-all hover:border-brand-accent/40 hover:shadow-card-hover">
        <span className="absolute inset-x-0 top-0 h-1 bg-brand-accent" />
        <div className="flex items-center justify-between">
          <p className="app-metric-label">Schedule complete</p>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent transition-colors">
            <CheckCircle2 size={14} />
          </span>
        </div>
        <p className="app-metric-value">{percentComplete}%</p>
        <div className="app-progress mt-3">
          <span style={{ width: `${percentComplete}%` }} className="bg-brand-accent transition-all duration-500" />
        </div>
      </Card>

      <Card className="group relative overflow-hidden p-5 transition-all hover:border-hairline hover:shadow-card-hover">
        <span className={`absolute inset-x-0 top-0 h-1 ${openRoadblocks > 0 ? "bg-error" : "bg-success"}`} />
        <div className="flex items-center justify-between">
          <p className="app-metric-label">Open roadblocks</p>
          <span className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${openRoadblocks > 0 ? "bg-error/10 text-error" : "bg-success/10 text-success"}`}>
            {openRoadblocks > 0 ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
          </span>
        </div>
        <p className={`app-metric-value ${openRoadblocks > 0 ? "text-error" : "text-success"}`}>
          {openRoadblocks}
        </p>
        <p className="app-metric-helper">
          {openRoadblocks > 0 ? "Needs owner attention" : "Zero active roadblocks"}
        </p>
      </Card>
    </div>
  );
}
