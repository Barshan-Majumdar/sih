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
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Completed
          </span>
        );
      case "AHEAD":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Ahead
          </span>
        );
      case "ON_TRACK":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            On Track
          </span>
        );
      case "MINOR_DELAY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            Minor Delay
          </span>
        );
      case "CRITICAL_DELAY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            Critical Delay
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-hairline pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-1 font-mono">
            {projectName} &middot; ID: {projectId.slice(-8)}
          </p>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink flex items-center gap-2.5">
            <TrendingUp className="w-5 h-5 text-ink" />
            Authoritative Plan vs. Actual Progress
          </h1>
          <p className="text-xs sm:text-sm text-muted mt-1">
            Duration-weighted progress rollup derived strictly from verified field evidence and engineering schedule dates.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/field-intake/${projectId}`}
            className="btn-interactive inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-hairline bg-surface-soft hover:bg-canvas text-xs font-semibold text-ink transition-colors shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-muted" />
            Field Intake
          </Link>
          <Link
            href={`/review-queue/${projectId}`}
            className="btn-interactive inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink hover:bg-ink/90 text-xs font-semibold text-canvas transition-colors shadow-xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Review Queue
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Planned Progress */}
        <div className="rounded-2xl border border-hairline bg-canvas p-5 shadow-card hover:shadow-card-hover transition-all space-y-2.5">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Linear Planned</span>
            <Clock className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-3xl font-extrabold tracking-tight font-mono text-ink">
            {rollup.plannedProgress}%
          </div>
          <div className="w-full bg-hairline/80 h-2 rounded-full overflow-hidden">
            <div
              className="bg-sky-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, rollup.plannedProgress))}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            Elapsed baseline across <span className="font-mono font-medium text-ink">{rollup.plannedDurationDays}</span> task days
          </p>
        </div>

        {/* Actual Progress */}
        <div className="rounded-2xl border border-hairline bg-canvas p-5 shadow-card hover:shadow-card-hover transition-all space-y-2.5">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Verified Actual</span>
            <Percent className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-3xl font-extrabold tracking-tight font-mono text-ink">
            {rollup.actualProgress}%
          </div>
          <div className="w-full bg-hairline/80 h-2 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, rollup.actualProgress))}%` }}
            />
          </div>
          <p className="text-xs text-muted">
            Aggregated duration-weighted actual site execution
          </p>
        </div>

        {/* Schedule Variance */}
        <div className="rounded-2xl border border-hairline bg-canvas p-5 shadow-card hover:shadow-card-hover transition-all space-y-2.5">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Schedule Variance</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className={`text-3xl font-extrabold tracking-tight font-mono ${
            rollup.variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          }`}>
            {rollup.variance > 0 ? `+${rollup.variance}%` : `${rollup.variance}%`}
          </div>
          <p className="text-xs text-muted">
            Actual progress minus planned target
          </p>
        </div>

        {/* Project Health Status */}
        <div className="rounded-2xl border border-hairline bg-canvas p-5 shadow-card hover:shadow-card-hover transition-all space-y-2.5">
          <div className="flex items-center justify-between text-muted">
            <span className="text-[11px] font-bold uppercase tracking-wider">Overall Health</span>
            {rollup.delayStatus === "CRITICAL_DELAY" ? (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            )}
          </div>
          <div className="pt-0.5">{getStatusBadge(rollup.delayStatus)}</div>
          <p className="text-xs text-muted">
            Authoritative delay status based on weighted variance
          </p>
        </div>
      </div>

      {/* Tasks Table with Search, Filter & Sort */}
      <div className="rounded-2xl border border-hairline bg-canvas overflow-hidden shadow-card">
        <div className="px-5 py-4 border-b border-hairline bg-surface-soft/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-muted" />
            <h3 className="font-semibold text-sm tracking-tight text-ink">
              Schedule Activities Progress Breakdown
            </h3>
            <span className="text-xs text-muted font-mono ml-1">
              ({filteredTasks.length} of {tasks.length} tasks)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search activities..."
                className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-hairline bg-canvas text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink w-44 transition-all"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-hairline bg-canvas text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink font-semibold transition-all shadow-2xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="CRITICAL_DELAY">Critical Delay (&lt; -10%)</option>
              <option value="MINOR_DELAY">Minor Delay (&le; -10%)</option>
              <option value="ON_TRACK">On Track (&plusmn;5%)</option>
              <option value="AHEAD">Ahead</option>
              <option value="COMPLETED">Completed</option>
            </select>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-muted" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                className="px-3 py-1.5 text-xs rounded-xl border border-hairline bg-canvas text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink font-semibold transition-all shadow-2xs"
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
            <thead>
              <tr className="border-b border-hairline bg-surface-soft/80 text-[11px] font-bold uppercase tracking-wider text-muted">
                <th className="py-3 px-4">Activity Name</th>
                <th className="py-3 px-4">Schedule Dates</th>
                <th className="py-3 px-4 text-center">Duration</th>
                <th className="py-3 px-4 text-center">Planned %</th>
                <th className="py-3 px-4 text-center">Actual %</th>
                <th className="py-3 px-4 text-center">Variance</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted text-xs">
                    {tasks.length === 0
                      ? "No schedule activities found. Import tasks via the CSV schedule importer."
                      : "No activities match your current filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const evalMetrics = evaluateTaskProgress(task, targetDate);

                  return (
                    <tr key={task.id} className="hover:bg-surface-soft/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold tracking-tight text-ink">
                        {task.name}
                      </td>
                      <td className="py-3.5 px-4 text-muted text-xs font-mono">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-muted" />
                          <span>
                            {formatDate(task.startDate)} – {formatDate(task.endDate)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-xs font-mono text-muted">
                        {evalMetrics.plannedDurationDays}d
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold font-mono text-xs text-sky-700 dark:text-sky-300">
                            {evalMetrics.plannedProgress}%
                          </span>
                          <div className="w-16 h-1.5 bg-hairline/80 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-sky-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, evalMetrics.plannedProgress))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold font-mono text-xs text-emerald-700 dark:text-emerald-300">
                            {evalMetrics.actualProgress}%
                          </span>
                          <div className="w-16 h-1.5 bg-hairline/80 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, evalMetrics.actualProgress))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className={`py-3.5 px-4 text-center font-bold font-mono text-xs ${
                        evalMetrics.variance >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
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
