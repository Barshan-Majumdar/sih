"use client";

import { useState } from "react";
import { AgiraMark } from "@/components/landing/AgiraMark";

type ViewId = "schedule" | "lookahead" | "weekly" | "portfolio";

const VIEWS: { id: ViewId; label: string; detail: string }[] = [
  { id: "schedule", label: "Master Schedule", detail: "Logic + critical path" },
  { id: "lookahead", label: "Lookahead", detail: "Field-ready work" },
  { id: "weekly", label: "Weekly Plan", detail: "Commitments + PPC" },
  { id: "portfolio", label: "Portfolio", detail: "Health + risk" },
];

const STATUS_COLOR = {
  done: "bg-success",
  active: "bg-brand-accent",
  delayed: "bg-error",
  upcoming: "bg-surface-strong",
};

export function LandingProductShowcase() {
  const [activeView, setActiveView] = useState<ViewId>("schedule");

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-canvas shadow-[0_28px_70px_rgba(16,23,32,0.13)]">
      <div className="flex min-h-14 items-center gap-3 bg-surface-dark px-4 text-on-dark sm:px-5">
        <AgiraMark size={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold sm:text-sm">Riverside Apartments - Phase 1</p>
          <p className="hidden text-[10px] text-on-dark-soft sm:block">Live project workspace</p>
        </div>
        <div className="hidden items-center gap-2 text-[10px] text-on-dark-soft sm:flex">
          <span className="h-2 w-2 rounded-full bg-success" />
          Synced just now
        </div>
        <div className="flex -space-x-1.5" aria-label="Project team online">
          {[
            ["JG", "bg-badge-violet"],
            ["MS", "bg-badge-orange"],
            ["SP", "bg-badge-emerald"],
          ].map(([initials, color]) => (
            <span
              key={initials}
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface-dark text-[8px] font-bold text-on-dark ${color}`}
            >
              {initials}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-hairline bg-surface-soft md:grid-cols-4" role="tablist">
        {VIEWS.map((view) => {
          const active = activeView === view.id;
          return (
            <button
              key={view.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`landing-view-${view.id}`}
              onClick={() => setActiveView(view.id)}
              className={`min-h-16 border-r border-hairline px-4 py-3 text-left transition-colors last:border-r-0 ${
                active ? "bg-canvas text-ink" : "text-muted hover:bg-canvas/70 hover:text-ink"
              }`}
            >
              <span className="flex items-center gap-2 text-xs font-semibold sm:text-sm">
                <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-brand-accent" : "bg-surface-strong"}`} />
                {view.label}
              </span>
              <span className="mt-1 hidden pl-3.5 text-[10px] text-muted-soft sm:block">{view.detail}</span>
            </button>
          );
        })}
      </div>

      <div
        key={activeView}
        id={`landing-view-${activeView}`}
        role="tabpanel"
        className="landing-panel-enter min-h-[500px] bg-surface-soft p-3 sm:min-h-[520px] sm:p-5"
      >
        {activeView === "schedule" && <ScheduleView />}
        {activeView === "lookahead" && <LookaheadView />}
        {activeView === "weekly" && <WeeklyView />}
        {activeView === "portfolio" && <PortfolioView />}
      </div>
    </div>
  );
}

function SectionToolbar({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action: string;
}) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-4 border-b border-hairline px-4">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-[10px] text-muted">{detail}</p>
      </div>
      <button
        type="button"
        className="h-8 shrink-0 rounded-md border border-hairline bg-canvas px-3 text-[11px] font-semibold text-ink shadow-sm"
      >
        {action}
      </button>
    </div>
  );
}

function ScheduleView() {
  const tasks = [
    { name: "Site prep & excavation", owner: "Jane GC", dates: "Jul 05 - Jul 10", status: "done" as const },
    { name: "Rough electrical wiring", owner: "Tom Electric", dates: "Jul 12 - Jul 20", status: "active" as const },
    { name: "Rough plumbing install", owner: "Sara Plumbing", dates: "Jul 16 - Jul 26", status: "delayed" as const },
    { name: "Electrical inspection", owner: "Tom Electric", dates: "Jul 21 - Jul 22", status: "upcoming" as const },
    { name: "Drywall installation", owner: "Unassigned", dates: "Jul 27 - Aug 04", status: "upcoming" as const },
  ];
  const bars = [
    { left: 2, width: 22, color: "bg-success" },
    { left: 25, width: 32, color: "bg-brand-accent" },
    { left: 35, width: 40, color: "bg-error" },
    { left: 62, width: 16, color: "bg-surface-strong" },
    { left: 75, width: 22, color: "bg-surface-strong" },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-canvas shadow-sm">
      <SectionToolbar title="Master Schedule" detail="5 activities · 1 critical path risk" action="+ Add task" />
      <div className="grid grid-cols-[minmax(310px,0.9fr)_minmax(430px,1.35fr)] overflow-x-auto">
        <div className="min-w-[310px] border-r border-hairline">
          <div className="grid grid-cols-[1fr_84px] border-b border-hairline bg-surface-soft px-4 py-2 text-[9px] font-semibold uppercase text-muted-soft">
            <span>Activity / responsible</span>
            <span>Dates</span>
          </div>
          {tasks.map((task) => (
            <div
              key={task.name}
              className="grid min-h-[70px] grid-cols-[1fr_84px] items-center border-b border-hairline-soft px-4 last:border-b-0"
            >
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_COLOR[task.status]}`} />
                  <p className="truncate text-xs font-semibold text-ink">{task.name}</p>
                </div>
                <p className="mt-1 pl-4 text-[10px] text-muted">{task.owner}</p>
              </div>
              <p className="text-[10px] leading-4 text-muted">{task.dates}</p>
            </div>
          ))}
        </div>

        <div className="min-w-[430px]">
          <div className="grid grid-cols-5 border-b border-hairline bg-surface-soft px-3 py-2 text-center text-[9px] font-semibold uppercase text-muted-soft">
            {["Jul 05", "Jul 12", "Jul 19", "Jul 26", "Aug 02"].map((date) => <span key={date}>{date}</span>)}
          </div>
          <div className="relative">
            <span className="absolute bottom-0 left-[56%] top-0 w-px bg-error/40" />
            {bars.map((bar, index) => (
              <div key={index} className="relative h-[70px] border-b border-hairline-soft last:border-b-0">
                <div className="absolute inset-0 grid grid-cols-5">
                  {[0, 1, 2, 3, 4].map((line) => <span key={line} className="border-r border-hairline-soft last:border-r-0" />)}
                </div>
                <span
                  className={`absolute top-1/2 h-5 -translate-y-1/2 rounded-md ${bar.color}`}
                  style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LookaheadView() {
  const weeks = [
    {
      label: "This week",
      dates: "Jul 13 - 19",
      tasks: [
        ["Rough electrical wiring", "Tom Electric", "Ready", "bg-success"],
        ["Rough plumbing install", "Sara Plumbing", "Blocked", "bg-error"],
        ["Set wall embeds", "Jane GC", "Ready", "bg-success"],
      ],
    },
    {
      label: "Week 2",
      dates: "Jul 20 - 26",
      tasks: [
        ["Electrical inspection", "Tom Electric", "Pending", "bg-warning"],
        ["Close interior walls", "Jane GC", "Ready", "bg-success"],
        ["Material delivery", "Sara Plumbing", "Ready", "bg-success"],
      ],
    },
    {
      label: "Week 3",
      dates: "Jul 27 - Aug 02",
      tasks: [
        ["Drywall installation", "Unassigned", "Needs owner", "bg-surface-strong"],
        ["Above-ceiling review", "Jane GC", "Ready", "bg-success"],
      ],
    },
  ];

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-canvas shadow-sm">
      <SectionToolbar title="4-Week Lookahead" detail="Master schedule synced · Jul 13 - Aug 09" action="Pull planning" />
      <div className="grid min-w-[780px] grid-cols-3 overflow-x-auto">
        {weeks.map((week, weekIndex) => (
          <div key={week.label} className="min-h-[390px] border-r border-hairline p-3 last:border-r-0">
            <div className="mb-3 flex items-start justify-between border-b border-hairline pb-3">
              <div>
                <p className="text-xs font-semibold text-ink">{week.label}</p>
                <p className="mt-0.5 text-[10px] text-muted">{week.dates}</p>
              </div>
              <span className="text-[10px] font-semibold text-muted-soft">0{weekIndex + 1}</span>
            </div>
            <div className="space-y-2">
              {week.tasks.map(([name, owner, status, color]) => (
                <div key={name} className="rounded-md border border-hairline bg-canvas p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold leading-4 text-ink">{name}</p>
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${color}`} />
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[10px]">
                    <span className="text-muted">{owner}</span>
                    <span className="font-medium text-body">{status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeeklyView() {
  const commitments = [
    ["Complete rough electrical - Level 2", "Tom Electric", "Completed", "bg-success"],
    ["Pass plumbing pressure test", "Sara Plumbing", "At risk", "bg-error"],
    ["Install corridor embeds", "Jane GC", "Committed", "bg-brand-accent"],
    ["Close inspection punch", "Tom Electric", "Completed", "bg-success"],
  ];

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-canvas shadow-sm">
      <SectionToolbar title="Weekly Work Plan" detail="Week of Jul 13 · 4 commitments" action="Commit task" />
      <div className="grid min-w-[760px] grid-cols-[1.45fr_0.75fr] overflow-x-auto">
        <div className="border-r border-hairline">
          <div className="grid grid-cols-[1fr_120px_90px] border-b border-hairline bg-surface-soft px-4 py-2 text-[9px] font-semibold uppercase text-muted-soft">
            <span>Commitment</span><span>Committed by</span><span>Status</span>
          </div>
          {commitments.map(([task, owner, status, color]) => (
            <div key={task} className="grid min-h-[72px] grid-cols-[1fr_120px_90px] items-center border-b border-hairline-soft px-4 last:border-b-0">
              <p className="pr-3 text-xs font-semibold text-ink">{task}</p>
              <p className="text-[10px] text-muted">{owner}</p>
              <span className="flex items-center gap-2 text-[10px] font-medium text-body">
                <span className={`h-2 w-2 rounded-full ${color}`} />{status}
              </span>
            </div>
          ))}
        </div>
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase text-muted-soft">Percent Plan Complete</p>
          <div className="mt-4 flex items-end justify-between border-b border-hairline pb-5">
            <p className="text-5xl font-semibold text-ink">75%</p>
            <span className="mb-1 text-[10px] font-semibold text-success">+8 pts</span>
          </div>
          <div className="mt-5">
            <div className="mb-2 flex justify-between text-[10px] text-muted"><span>Complete</span><span>3 / 4</span></div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-strong"><span className="block h-full w-3/4 bg-success" /></div>
          </div>
          <div className="mt-7 border-t border-hairline pt-5">
            <p className="text-[10px] font-semibold uppercase text-muted-soft">Variance signal</p>
            <p className="mt-2 text-xs font-semibold text-ink">Inspection availability</p>
            <p className="mt-1 text-[10px] leading-4 text-muted">Most common reason this week</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioView() {
  const projects = [
    ["Riverside Apartments", "82", "68%", "1", "bg-success"],
    ["Northline Medical", "74", "51%", "3", "bg-brand-accent"],
    ["Cedar Logistics Hub", "58", "43%", "6", "bg-error"],
  ];

  return (
    <div className="overflow-hidden rounded-md border border-hairline bg-canvas shadow-sm">
      <SectionToolbar title="Executive Dashboard" detail="3 active projects · Portfolio health 71" action="View timeline" />
      <div className="grid grid-cols-2 border-b border-hairline sm:grid-cols-4">
        {[["Active projects", "3"], ["Total tasks", "184"], ["Open roadblocks", "10"], ["Avg. health", "71"]].map(([label, value], index) => (
          <div key={label} className="border-r border-hairline px-4 py-4 last:border-r-0">
            <p className="text-[9px] font-semibold uppercase text-muted-soft">{label}</p>
            <p className={`mt-2 text-2xl font-semibold ${index === 2 ? "text-error" : "text-ink"}`}>{value}</p>
          </div>
        ))}
      </div>
      <div className="grid min-w-[760px] grid-cols-[1.3fr_0.7fr] overflow-x-auto">
        <div className="border-r border-hairline">
          <div className="grid grid-cols-[1fr_80px_80px_80px] border-b border-hairline bg-surface-soft px-4 py-2 text-[9px] font-semibold uppercase text-muted-soft">
            <span>Project</span><span>Health</span><span>Complete</span><span>Risk</span>
          </div>
          {projects.map(([name, health, complete, risk, color]) => (
            <div key={name} className="grid min-h-[72px] grid-cols-[1fr_80px_80px_80px] items-center border-b border-hairline-soft px-4 last:border-b-0">
              <div><p className="text-xs font-semibold text-ink">{name}</p><p className="mt-1 text-[10px] text-muted">Updated today</p></div>
              <span className="flex items-center gap-2 text-xs font-semibold"><span className={`h-2 w-2 rounded-full ${color}`} />{health}</span>
              <span className="text-xs text-muted">{complete}</span>
              <span className={`text-xs font-semibold ${Number(risk) > 3 ? "text-error" : "text-body"}`}>{risk}</span>
            </div>
          ))}
        </div>
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase text-muted-soft">Health distribution</p>
          <div className="mt-6 flex h-44 items-end gap-5 border-b border-hairline px-3">
            {[["RIV", 82, "bg-success"], ["NOR", 74, "bg-brand-accent"], ["CED", 58, "bg-error"]].map(([label, height, color]) => (
              <div key={String(label)} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-semibold text-body">{height}</span>
                <span className={`w-full rounded-t-md ${color}`} style={{ height: `${Number(height) * 1.25}px` }} />
                <span className="text-[9px] font-semibold text-muted-soft">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
