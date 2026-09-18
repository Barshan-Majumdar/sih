"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarCheck,
  CalendarClock,
  ChartGantt,
  DraftingCompass,
  FolderOpen,
  Gauge,
  GitCompareArrows,
  ListTodo,
  OctagonAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Users,
  Waypoints,
} from "lucide-react";

const TAB_GROUPS = [
  {
    label: "Field & AI Bridge",
    tabs: [
      { href: "/field-intake", label: "Field Intake", icon: Sparkles },
      { href: "/review-queue", label: "Review Queue", icon: ShieldCheck },
      { href: "/plan-vs-actual", label: "Plan vs Actual", icon: TrendingUp },
    ],
  },
  {
    label: "Schedule",
    tabs: [
      { href: "/gantt", label: "Gantt (CPM)", icon: ChartGantt },
      { href: "", label: "Tasks", icon: ListTodo },
      { href: "/lookahead", label: "Lookahead", icon: CalendarClock },
      { href: "/weekly-plan", label: "Weekly Plan", icon: CalendarCheck },
      { href: "/pull-planning", label: "Pull Planning", icon: Waypoints },
    ],
  },
  {
    label: "Control",
    tabs: [
      { href: "/roadblocks", label: "Roadblocks", icon: OctagonAlert },
      { href: "/impacts", label: "Impacts", icon: TriangleAlert },
      { href: "/files", label: "Files (OCR)", icon: FolderOpen },
      { href: "/drawings", label: "Drawings", icon: DraftingCompass },
    ],
  },
  {
    label: "Analytics",
    tabs: [
      { href: "/dashboard", label: "Dashboard", icon: Gauge },
      { href: "/baselines", label: "Baselines", icon: GitCompareArrows },
      { href: "/activity", label: "Activity Log", icon: Activity },
      { href: "/members", label: "Members", icon: Users },
    ],
  },
];
const PROJECT_TABS = TAB_GROUPS.flatMap((group) => group.tabs);

type ProjectTab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export function ProjectSubNav({ projectId, active }: { projectId: string; active: string }) {
  const router = useRouter();
  const projectRoutes = useMemo(
    () => PROJECT_TABS.map((tab) => `/projects/${projectId}${tab.href}`),
    [projectId]
  );

  useEffect(() => {
    const likelyRoutes = ["", "/lookahead", "/weekly-plan", "/gantt", "/dashboard"].map(
      (href) => `/projects/${projectId}${href}`
    );
    const timeout = window.setTimeout(() => {
      for (const href of likelyRoutes) {
        router.prefetch(href);
      }
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [projectId, router]);

  const prefetchProjectRoute = useCallback(
    (href: string) => {
      if (projectRoutes.includes(href)) {
        router.prefetch(href);
      }
    },
    [projectRoutes, router]
  );

  return (
    <nav
      aria-label="Project workspace"
      className="fixed bottom-3 left-[84px] right-3 z-30 rounded-xl border border-hairline bg-canvas/95 p-2 shadow-[0_16px_40px_rgba(17,17,17,0.14)] ring-1 ring-hairline-soft backdrop-blur-xl md:bottom-auto md:left-4 md:right-auto md:top-[88px] md:w-[58px] md:rounded-xl md:p-1.5"
    >
      <div className="flex items-center gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {PROJECT_TABS.map((tab) => (
          <ProjectRailLink
            key={tab.label}
            projectId={projectId}
            tab={tab}
            active={tab.label === active}
            onIntent={prefetchProjectRoute}
          />
        ))}
      </div>
    </nav>
  );
}

function ProjectRailLink({
  projectId,
  tab,
  active,
  onIntent,
}: {
  projectId: string;
  tab: ProjectTab;
  active: boolean;
  onIntent: (href: string) => void;
}) {
  const Icon = tab.icon;
  const href = `/projects/${projectId}${tab.href}`;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={tab.label}
      title={tab.label}
      onFocus={() => onIntent(href)}
      onPointerEnter={() => onIntent(href)}
      className={`group relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors md:h-10 md:w-10 ${
        active
          ? "bg-ink text-canvas shadow-[0_4px_12px_rgba(17,17,17,0.16)]"
          : "text-body hover:bg-surface-soft hover:text-ink"
      }`}
    >
      <Icon size={19} strokeWidth={2} aria-hidden />
      <span className="sr-only">{tab.label}</span>
      <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-10 hidden -translate-y-1/2 whitespace-nowrap rounded-md border border-hairline bg-canvas px-2 py-1 text-xs font-semibold text-ink opacity-0 shadow-[0_8px_20px_rgba(17,17,17,0.12)] transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 md:block">
        {tab.label}
      </span>
    </Link>
  );
}

const ACTIVE_TAB_BY_SEGMENT: Record<string, string> = {
  activity: "Activity",
  baselines: "Baselines",
  dashboard: "Dashboard",
  drawings: "Drawings",
  files: "Files",
  gantt: "Gantt",
  impacts: "Impacts",
  lookahead: "Lookahead",
  members: "Members",
  "pull-planning": "Pull Planning",
  rfis: "RFIs",
  roadblocks: "Roadblocks",
  submittals: "Submittals",
  tasks: "Tasks",
  "weekly-plan": "Weekly Plan",
};

export function ProjectRouteSubNav() {
  const pathname = usePathname();
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/([^/]+))?/);
  const hasProjectRail = Boolean(match && decodeURIComponent(match[1]) !== "new");

  useEffect(() => {
    document.body.classList.toggle("has-project-rail", hasProjectRail);
    return () => document.body.classList.remove("has-project-rail");
  }, [hasProjectRail]);

  if (!match) return null;

  const projectId = decodeURIComponent(match[1]);
  if (projectId === "new") return null;
  const active = ACTIVE_TAB_BY_SEGMENT[match[2] ?? ""] ?? "Tasks";

  return <ProjectSubNav projectId={projectId} active={active} />;
}
