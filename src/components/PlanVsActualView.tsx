"use client";

import {
  evaluateTaskProgress,
  calculateDurationWeightedRollup,
  type DelayStatus,
} from "@/lib/schedule-progress";
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Percent,
} from "lucide-react";

interface TaskItem {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  status: string;
}

interface PlanVsActualViewProps {
  projectId: string;
  projectName: string;
  tasks: TaskItem[];
}

export function PlanVsActualView({
  projectId,
  projectName,
  tasks,
}: PlanVsActualViewProps) {
  const targetDate = new Date();

  // Compute duration-weighted overall metrics
  const rollup = calculateDurationWeightedRollup(tasks, targetDate);

  const getStatusBadge = (status: DelayStatus) => {
    switch (status) {
      case "COMPLETED":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Completed
          </span>
        );
      case "AHEAD":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            Ahead of Schedule
          </span>
        );
      case "ON_TRACK":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            On Track (&plusmn;5%)
          </span>
        );
      case "MINOR_DELAY":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Minor Delay (&le; -10%)
          </span>
        );
      case "CRITICAL_DELAY":
        return (
          <span className="px-2.5 py-1 rounded text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/20">
            Critical Delay (&lt; -10%)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-border pb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          {projectName} &middot; ID: {projectId.slice(-8)}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          Authoritative Plan vs. Actual Progress
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Duration-weighted progress rollup derived strictly from verified field evidence and engineering schedule dates.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Planned Progress */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Linear Planned</span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold text-foreground">
            {rollup.plannedProgress}%
          </div>
          <p className="text-xs text-muted-foreground">
            Elapsed time baseline across {rollup.plannedDurationDays} total task days
          </p>
        </div>

        {/* Actual Progress */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Verified Actual</span>
            <Percent className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-bold text-foreground">
            {rollup.actualProgress}%
          </div>
          <p className="text-xs text-muted-foreground">
            Aggregated duration-weighted actual site execution
          </p>
        </div>

        {/* Schedule Variance */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Schedule Variance</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className={`text-3xl font-bold ${
            rollup.variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
          }`}>
            {rollup.variance > 0 ? `+${rollup.variance}%` : `${rollup.variance}%`}
          </div>
          <p className="text-xs text-muted-foreground">
            Actual progress minus planned target
          </p>
        </div>

        {/* Project Health Status */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium uppercase tracking-wider">Overall Health</span>
            {rollup.delayStatus === "CRITICAL_DELAY" ? (
              <AlertTriangle className="w-4 h-4 text-destructive" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div className="pt-1">{getStatusBadge(rollup.delayStatus)}</div>
          <p className="text-xs text-muted-foreground">
            Authoritative delay status based on weighted variance
          </p>
        </div>
      </div>

      {/* Tasks Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            Schedule Activities Progress Breakdown
          </h3>
          <span className="text-xs text-muted-foreground">
            {tasks.length} master schedule tasks
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase font-medium text-muted-foreground tracking-wider">
              <tr>
                <th className="py-3 px-4">Activity Name</th>
                <th className="py-3 px-4">Schedule Dates</th>
                <th className="py-3 px-4 text-center">Duration</th>
                <th className="py-3 px-4 text-center">Planned %</th>
                <th className="py-3 px-4 text-center">Actual %</th>
                <th className="py-3 px-4 text-center">Variance</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No schedule activities found. Import tasks via the CSV schedule importer.
                  </td>
                </tr>
              ) : (
                tasks.map((task) => {
                  const evalMetrics = evaluateTaskProgress(task, targetDate);

                  return (
                    <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3.5 px-4 font-medium text-foreground">
                        {task.name}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-xs">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>
                            {new Date(task.startDate).toLocaleDateString()} -{" "}
                            {new Date(task.endDate).toLocaleDateString()}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs font-mono text-muted-foreground">
                        {evalMetrics.plannedDurationDays}d
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-blue-600 dark:text-blue-400">
                        {evalMetrics.plannedProgress}%
                      </td>
                      <td className="py-3.5 px-4 text-center font-semibold text-emerald-600 dark:text-emerald-400">
                        {evalMetrics.actualProgress}%
                      </td>
                      <td className={`py-3.5 px-4 text-center font-bold ${
                        evalMetrics.variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
                      }`}>
                        {evalMetrics.variance > 0 ? `+${evalMetrics.variance}%` : `${evalMetrics.variance}%`}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {getStatusBadge(evalMetrics.delayStatus)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
