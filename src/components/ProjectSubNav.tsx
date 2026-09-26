"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CalendarCheck,
  CalendarClock,
  ChartGantt,
  DraftingCompass,
  FolderKanban,
  FolderOpen,
  Gauge,
  GitCompareArrows,
  LayoutDashboard,
  ListTodo,
  OctagonAlert,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  Users,
  Waypoints,
} from "lucide-react";

type ProjectToolTab = {
  segment: string;
  label: string;
  icon: LucideIcon;
};

// Clean page-wise tabs
const PROJECT_TABS: ProjectToolTab[] = [
  { segment: "dashboard", label: "Project Dashboard", icon: Gauge },
  { segment: "gantt", label: "Gantt (CPM)", icon: ChartGantt },
  { segment: "tasks", label: "Tasks", icon: ListTodo },
  { segment: "field-intake", label: "Field Intake", icon: Sparkles },
  { segment: "review-queue", label: "Review Queue", icon: ShieldCheck },
  { segment: "plan-vs-actual", label: "Plan vs Actual", icon: TrendingUp },
  { segment: "lookahead", label: "Lookahead", icon: CalendarClock },
  { segment: "weekly-plan", label: "Weekly Plan", icon: CalendarCheck },
  { segment: "pull-planning", label: "Pull Planning", icon: Waypoints },
  { segment: "roadblocks", label: "Roadblocks", icon: OctagonAlert },
  { segment: "impacts", label: "Impacts", icon: TriangleAlert },
  { segment: "files", label: "Files (OCR)", icon: FolderOpen },
  { segment: "drawings", label: "Drawings", icon: DraftingCompass },
  { segment: "baselines", label: "Baselines", icon: GitCompareArrows },
  { segment: "activity", label: "Activity Log", icon: Activity },
  { segment: "members", label: "Members", icon: Users },
];

const SEGMENT_TO_LABEL: Record<string, string> = {
  dashboard: "Project Dashboard",
  gantt: "Gantt (CPM)",
  gantt_chart: "Gantt (CPM)",
  tasks: "Tasks",
  "field-intake": "Field Intake",
  "review-queue": "Review Queue",
  "plan-vs-actual": "Plan vs Actual",
  lookahead: "Lookahead",
  "weekly-plan": "Weekly Plan",
  "pull-planning": "Pull Planning",
  roadblocks: "Roadblocks",
  impacts: "Impacts",
  files: "Files (OCR)",
  drawings: "Drawings",
  rfis: "Files (OCR)",
  submittals: "Files (OCR)",
  baselines: "Baselines",
  activity: "Activity Log",
  members: "Members",
};

const LEGACY_SEGMENT_TO_LABEL: Record<string, string> = {
  "": "Tasks",
  dashboard: "Project Dashboard",
  gantt: "Gantt (CPM)",
  tasks: "Tasks",
  "field-intake": "Field Intake",
  "review-queue": "Review Queue",
  "plan-vs-actual": "Plan vs Actual",
  lookahead: "Lookahead",
  "weekly-plan": "Weekly Plan",
  "pull-planning": "Pull Planning",
  roadblocks: "Roadblocks",
  impacts: "Impacts",
  files: "Files (OCR)",
  drawings: "Drawings",
  rfis: "Files (OCR)",
  submittals: "Files (OCR)",
  baselines: "Baselines",
  activity: "Activity Log",
  members: "Members",
};

function parseCurrentRoute(pathname: string): { activeLabel: string; routeProjectId: string | null } {
  // 1. Clean page-wise routes: /toolSegment/:projectId
  const cleanMatch = pathname.match(
    /^\/(dashboard|gantt|gantt_chart|tasks|field-intake|review-queue|plan-vs-actual|lookahead|weekly-plan|pull-planning|roadblocks|impacts|files|drawings|rfis|submittals|baselines|activity|members)\/([^/]+)/
  );
  if (cleanMatch) {
    const segment = cleanMatch[1];
    const pid = decodeURIComponent(cleanMatch[2]);
    return {
      activeLabel: SEGMENT_TO_LABEL[segment] || "Project Dashboard",
      routeProjectId: pid,
    };
  }

  // 2. Legacy project routes: /projects/:projectId/...
  const legacyMatch = pathname.match(/^\/projects\/([^/]+)(?:\/([^/]+))?/);
  if (legacyMatch && legacyMatch[1] !== "new") {
    const pid = decodeURIComponent(legacyMatch[1]);
    const segment = legacyMatch[2] ?? "";
    return {
      activeLabel: LEGACY_SEGMENT_TO_LABEL[segment] ?? "Tasks",
      routeProjectId: pid,
    };
  }

  // 3. Top-level portfolio routes
  if (pathname === "/dashboard") {
    return { activeLabel: "Portfolio Dashboard", routeProjectId: null };
  }
  if (pathname.startsWith("/projects")) {
    return { activeLabel: "Projects", routeProjectId: null };
  }

  return { activeLabel: "", routeProjectId: null };
}

export function ProjectRouteSubNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const { activeLabel, routeProjectId } = useMemo(
    () => parseCurrentRoute(pathname),
    [pathname]
  );

  // Synchronize active project ID
  useEffect(() => {
    if (routeProjectId && routeProjectId !== "new") {
      setActiveProjectId(routeProjectId);
      try {
        localStorage.setItem("agira_active_project_id", routeProjectId);
        fetch("/api/projects/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: routeProjectId }),
        }).catch(() => {});
      } catch {}
    } else {
      // Restore from localStorage or fetch default active project
      try {
        const stored = localStorage.getItem("agira_active_project_id");
        if (stored && stored !== "new") {
          setActiveProjectId(stored);
        } else {
          fetch("/api/projects/active")
            .then((res) => res.json())
            .then((data) => {
              if (data?.project?.id) {
                setActiveProjectId(data.project.id);
                localStorage.setItem("agira_active_project_id", data.project.id);
              }
            })
            .catch(() => {});
        }
      } catch {}
    }
  }, [routeProjectId]);

  // Ensure body has the padding class across all authenticated views
  useEffect(() => {
    document.body.classList.add("has-project-rail");
    return () => {
      // Keep persistent rail active on app shell
    };
  }, []);

  const effectiveProjectId = routeProjectId || activeProjectId;

  const handleIntent = useCallback(
    (href: string) => {
      router.prefetch(href);
    },
    [router]
  );

  return (
    <nav
      aria-label="Application navigation rail"
      className="fixed bottom-3 left-3 right-3 z-30 flex items-center justify-between rounded-2xl border border-hairline/90 bg-canvas/95 p-1.5 shadow-[0_12px_36px_rgba(15,23,42,0.12)] ring-1 ring-hairline-soft/80 backdrop-blur-xl md:bottom-auto md:left-4 md:right-auto md:top-[84px] md:w-[58px] md:max-h-[calc(100vh-100px)] md:flex-col md:overflow-y-auto md:rounded-2xl md:p-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      <div className="flex w-full items-center gap-1 overflow-x-auto md:flex-col md:overflow-visible">
        {/* Portfolio Overview */}
        <SidebarRailLink
          href="/dashboard"
          label="Portfolio Dashboard"
          icon={LayoutDashboard}
          active={activeLabel === "Portfolio Dashboard"}
          onIntent={handleIntent}
        />

        {/* All Projects Directory */}
        <SidebarRailLink
          href="/projects"
          label="Projects Directory"
          icon={FolderKanban}
          active={activeLabel === "Projects"}
          onIntent={handleIntent}
        />

        {/* Subtle Section Divider */}
        <div className="my-1 hidden h-px w-8 bg-hairline-soft md:block" aria-hidden />

        {/* Project Specific Workspaces */}
        {PROJECT_TABS.map((tab) => {
          const href = effectiveProjectId
            ? `/${tab.segment}/${effectiveProjectId}`
            : `/projects`;
          const active = activeLabel === tab.label;

          return (
            <SidebarRailLink
              key={tab.segment}
              href={href}
              label={tab.label}
              icon={tab.icon}
              active={active}
              onIntent={handleIntent}
            />
          );
        })}
      </div>
    </nav>
  );
}

function SidebarRailLink({
  href,
  label,
  icon: Icon,
  active,
  onIntent,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  onIntent: (href: string) => void;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      aria-label={label}
      title={label}
      onFocus={() => onIntent(href)}
      onPointerEnter={() => onIntent(href)}
      className={`group relative btn-interactive inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
        active
          ? "border border-ink bg-ink text-canvas shadow-[0_2px_8px_rgba(15,23,42,0.16)]"
          : "border border-transparent text-muted hover:border-hairline hover:bg-surface-soft hover:text-ink"
      }`}
    >
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} aria-hidden />
      <span className="sr-only">{label}</span>
      <span className="pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 hidden -translate-y-1/2 whitespace-nowrap rounded-lg border border-hairline/90 bg-canvas/95 px-2.5 py-1 text-xs font-semibold text-ink opacity-0 shadow-[0_8px_20px_rgba(15,23,42,0.1)] backdrop-blur-md transition-all duration-150 group-hover:opacity-100 group-focus-visible:opacity-100 md:block">
        {label}
      </span>
    </Link>
  );
}

// Backward compatibility export
export const ProjectSubNav = ProjectRouteSubNav;
