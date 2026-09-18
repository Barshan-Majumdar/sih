"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  evaluateTaskProgress,
  calculateDurationWeightedRollup,
  type DelayStatus,
} from "@/lib/schedule-progress";
import { formatDate } from "@/lib/utils";
import {
  TrendingUp,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Percent,
  Search,
  Sparkles,
  ShieldCheck,
  ArrowUpDown,
} from "lucide-react";

interface TaskItem {
  id: string;
  name: string;
  startDate: Date | string;
  endDate: Date | string;
  progress: number;
  status: string;
}

interface PlanVsActualViewProps {
  projectId: string;
  projectName: string;
  tasks: TaskItem[];
}

type SortOption = "DEFAULT" | "VARIANCE_ASC" | "VARIANCE_DESC" | "DURATION_DESC" | "NAME_ASC";

export function PlanVsActualView({
  projectId,
  projectName,
  tasks,
}: PlanVsActualViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<SortOption>("DEFAULT");

  const targetDate = useMemo(() => new Date(), []);

  // Compute duration-weighted overall metrics
  const rollup = useMemo(
    () => calculateDurationWeightedRollup(tasks, targetDate),
    [tasks, targetDate]
  );

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

  const filteredTasks = useMemo(() => {
    const list = tasks.filter((task) => {
      const matchesSearch = task.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (statusFilter === "ALL") return true;

      const evalMetrics = evaluateTaskProgress(task, targetDate);
      return evalMetrics.delayStatus === statusFilter;
    });

    if (sortBy === "DEFAULT") return list;

    return [...list].sort((a, b) => {
      const evalA = evaluateTaskProgress(a, targetDate);
      const evalB = evaluateTaskProgress(b, targetDate);

      switch (sortBy) {
        case "VARIANCE_ASC":
          return evalA.variance - evalB.variance; // most delayed first
        case "VARIANCE_DESC":
          return evalB.variance - evalA.variance; // furthest ahead first
        case "DURATION_DESC":
          return evalB.plannedDurationDays - evalA.plannedDurationDays;
        case "NAME_ASC":
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });
  }, [tasks, searchQuery, statusFilter, sortBy, targetDate]);

  return (
    <div className="space-y-6">
      {/* Header with Navigation Bridge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
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
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/projects/${projectId}/field-intake`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Field Intake
          </Link>
          <Link
            href={`/projects/${projectId}/review-queue`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-accent text-xs font-semibold text-foreground transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-primary" />
            Review Queue
          </Link>
        </div>
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
          <div className="w-full bg-blue-500/15 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-blue-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, rollup.plannedProgress))}%` }}
            />
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
          <div className="w-full bg-emerald-500/15 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, Math.max(0, rollup.actualProgress))}%` }}
            />
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

      {/* Tasks Table with Search, Filter & Sort */}
      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">
              Schedule Activities Progress Breakdown
            </h3>
            <span className="text-xs text-muted-foreground ml-1">
              ({filteredTasks.length} of {tasks.length} tasks)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search activities..."
                className="pl-8 pr-3 py-1 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="CRITICAL_DELAY">Critical Delay (&lt; -10%)</option>
              <option value="MINOR_DELAY">Minor Delay (&le; -10%)</option>
              <option value="ON_TRACK">On Track (&plusmn;5%)</option>
              <option value="AHEAD">Ahead</option>
              <option value="COMPLETED">Completed</option>
            </select>

            <div className="flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-2.5 py-1 text-xs rounded-md border border-input bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium"
              >
                <option value="DEFAULT">Default Order</option>
                <option value="VARIANCE_ASC">Most Delayed First</option>
                <option value="VARIANCE_DESC">Furthest Ahead First</option>
                <option value="DURATION_DESC">Longest Duration</option>
                <option value="NAME_ASC">Name (A-Z)</option>
              </select>
            </div>
          </div>
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
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground text-xs">
                    {tasks.length === 0
                      ? "No schedule activities found. Import tasks via the CSV schedule importer."
                      : "No activities match your current filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
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
                            {formatDate(task.startDate)} - {formatDate(task.endDate)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs font-mono text-muted-foreground">
                        {evalMetrics.plannedDurationDays}d
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold text-xs text-blue-600 dark:text-blue-400">
                            {evalMetrics.plannedProgress}%
                          </span>
                          <div className="w-16 h-1.5 bg-blue-500/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, evalMetrics.plannedProgress))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-semibold text-xs text-emerald-600 dark:text-emerald-400">
                            {evalMetrics.actualProgress}%
                          </span>
                          <div className="w-16 h-1.5 bg-emerald-500/20 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, evalMetrics.actualProgress))}%` }}
                            />
                          </div>
                        </div>
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
