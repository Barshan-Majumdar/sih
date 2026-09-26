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
  ChevronLeft,
  ChevronRight,
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
  X,
} from "lucide-react";

type NavItem = {
  segment: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

type NavGroup = {
  heading: string;
  collapsedHeading: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Core Navigation",
    collapsedHeading: "Core",
    items: [
      { segment: "dashboard", label: "Portfolio Dashboard", icon: LayoutDashboard },
      { segment: "projects", label: "Projects Directory", icon: FolderKanban },
    ],
  },
  {
    heading: "Schedule & CPM",
    collapsedHeading: "Schedule",
    items: [
      { segment: "project-dashboard", label: "Project Analytics", icon: Gauge },
      { segment: "gantt", label: "Gantt (CPM)", icon: ChartGantt },
      { segment: "tasks", label: "Master Tasks", icon: ListTodo },
      { segment: "lookahead", label: "6-Week Lookahead", icon: CalendarClock },
      { segment: "weekly-plan", label: "Weekly Commitments", icon: CalendarCheck },
      { segment: "pull-planning", label: "Pull Planning", icon: Waypoints },
    ],
  },
  {
    heading: "Field & AI Engine",
    collapsedHeading: "Field / AI",
    items: [
      { segment: "field-intake", label: "Field Intake (DPR)", icon: Sparkles, badge: "AI" },
      { segment: "review-queue", label: "Review Queue", icon: ShieldCheck },
      { segment: "plan-vs-actual", label: "Plan vs Actual", icon: TrendingUp },
    ],
  },
  {
    heading: "Project Controls",
    collapsedHeading: "Controls",
    items: [
      { segment: "roadblocks", label: "Roadblocks & Risks", icon: OctagonAlert },
      { segment: "impacts", label: "Delay Impacts", icon: TriangleAlert },
      { segment: "files", label: "Files & Evidence", icon: FolderOpen },
      { segment: "drawings", label: "Drawings & Specs", icon: DraftingCompass },
      { segment: "baselines", label: "Schedule Baselines", icon: GitCompareArrows },
      { segment: "activity", label: "Activity Audit", icon: Activity },
      { segment: "members", label: "Project Team", icon: Users },
    ],
  },
];

const SEGMENT_TO_KEY: Record<string, string> = {
  dashboard: "dashboard",
  agent: "project-dashboard",
  projects: "projects",
  gantt: "gantt",
  gantt_chart: "gantt",
  tasks: "tasks",
  "field-intake": "field-intake",
  "review-queue": "review-queue",
  "plan-vs-actual": "plan-vs-actual",
  lookahead: "lookahead",
  "weekly-plan": "weekly-plan",
  "pull-planning": "pull-planning",
  roadblocks: "roadblocks",
  impacts: "impacts",
  files: "files",
  drawings: "drawings",
  rfis: "files",
  submittals: "files",
  baselines: "baselines",
  activity: "activity",
  members: "members",
};

export function ProjectRouteSubNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string | null>(null);

  // Parse active item & project from path
  const { currentKey, currentProjectId } = useMemo(() => {
    // 1. Clean routes: /tool/:projectId
    const cleanMatch = pathname.match(
      /^\/(dashboard|agent|gantt|gantt_chart|tasks|field-intake|review-queue|plan-vs-actual|lookahead|weekly-plan|pull-planning|roadblocks|impacts|files|drawings|rfis|submittals|baselines|activity|members)\/([^/]+)/
    );
    if (cleanMatch) {
      const seg = cleanMatch[1];
      const pid = decodeURIComponent(cleanMatch[2]);
      const key = seg === "dashboard" ? "project-dashboard" : (SEGMENT_TO_KEY[seg] ?? seg);
      return { currentKey: key, currentProjectId: pid };
    }

    // 2. Legacy routes: /projects/:projectId/...
    const legMatch = pathname.match(/^\/projects\/([^/]+)(?:\/([^/]+))?/);
    if (legMatch && legMatch[1] !== "new") {
      const pid = decodeURIComponent(legMatch[1]);
      const seg = legMatch[2] ?? "";
      const key = seg === "dashboard" ? "project-dashboard" : (SEGMENT_TO_KEY[seg] ?? "tasks");
      return { currentKey: key, currentProjectId: pid };
    }

    // 3. Top-level routes
    if (pathname === "/dashboard") {
      return { currentKey: "dashboard", currentProjectId: null };
    }
    if (pathname === "/projects" || pathname.startsWith("/projects/")) {
      return { currentKey: "projects", currentProjectId: null };
    }

    return { currentKey: "", currentProjectId: null };
  }, [pathname]);

  // Synchronize active project
  useEffect(() => {
    if (currentProjectId && currentProjectId !== "new") {
      setActiveProjectId(currentProjectId);
      try {
        localStorage.setItem("agira_active_project_id", currentProjectId);
        fetch("/api/projects/active", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: currentProjectId }),
        }).catch(() => {});
      } catch {}
    } else {
      try {
        const stored = localStorage.getItem("agira_active_project_id");
        if (stored && stored !== "new") {
          setActiveProjectId(stored);
        } else {
          fetch("/api/projects/active")
            .then((r) => r.json())
            .then((data) => {
              if (data?.project?.id) {
                setActiveProjectId(data.project.id);
                setActiveProjectName(data.project.name);
                localStorage.setItem("agira_active_project_id", data.project.id);
              }
            })
            .catch(() => {});
        }
      } catch {}
    }
  }, [currentProjectId]);

  // Restore collapsed state
  useEffect(() => {
    try {
      const isCol = localStorage.getItem("agira_sidebar_collapsed") === "true";
      setCollapsed(isCol);
      document.body.classList.toggle("sidebar-collapsed", isCol);
    } catch {}
    document.body.classList.add("has-project-rail");
  }, []);

  // Listen to toggle events from NavBar
  useEffect(() => {
    const handleToggle = () => {
      if (window.innerWidth < 768) {
        setMobileOpen((prev) => !prev);
      } else {
        setCollapsed((prev) => {
          const next = !prev;
          try {
            localStorage.setItem("agira_sidebar_collapsed", String(next));
          } catch {}
          document.body.classList.toggle("sidebar-collapsed", next);
          return next;
        });
      }
    };

    window.addEventListener("agira:toggle-sidebar", handleToggle);
    return () => window.removeEventListener("agira:toggle-sidebar", handleToggle);
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("agira_sidebar_collapsed", String(next));
      } catch {}
      document.body.classList.toggle("sidebar-collapsed", next);
      return next;
    });
  }, []);

  const effectiveProjectId = currentProjectId || activeProjectId;

  const getHref = (item: NavItem) => {
    if (item.segment === "dashboard") return "/dashboard";
    if (item.segment === "projects") return "/projects";
    if (item.segment === "project-dashboard") {
      return effectiveProjectId ? `/dashboard/${effectiveProjectId}` : "/dashboard";
    }
    return effectiveProjectId ? `/${item.segment}/${effectiveProjectId}` : "/projects";
  };

  const handlePrefetch = (href: string) => {
    router.prefetch(href);
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          role="presentation"
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-xs transition-opacity md:hidden"
        />
      )}

      {/* Main Sidebar Element */}
      <aside
        aria-label="Workspace navigation"
        className={`fixed top-14 bottom-0 left-0 z-40 flex flex-col border-r border-hairline/80 bg-canvas/95 backdrop-blur-xl transition-[width,transform] duration-200 ease-out md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${collapsed ? "w-[88px]" : "w-64"}`}
      >
        {/* Mobile Header Close */}
        <div className="flex h-12 items-center justify-between border-b border-hairline px-4 md:hidden">
          <span className="font-display text-xs font-bold text-ink">Navigation</span>
          <button
            type="button"
            onClick={closeMobile}
            className="rounded-lg p-1 text-muted hover:bg-surface-soft hover:text-ink"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Active Project Switcher Banner */}
        {collapsed ? (
          <div className="border-b border-hairline/60 py-2.5 px-2 text-center">
            <Link
              href="/projects"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-surface-soft/80 transition-colors hover:border-brand-accent/50 hover:bg-surface-strong"
              title={activeProjectName ? `Active: ${activeProjectName} (Click to switch)` : "Switch project"}
            >
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            </Link>
          </div>
        ) : (
          <div className="border-b border-hairline/60 p-3">
            <Link
              href="/projects"
              onClick={closeMobile}
              className="group flex items-center justify-between rounded-xl border border-hairline/80 bg-surface-soft/60 p-2.5 transition-all hover:border-hairline hover:bg-surface-soft"
              title="Click to switch active project"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  <span>Active Workspace</span>
                </div>
                <div className="truncate text-xs font-semibold text-ink group-hover:text-brand-accent transition-colors">
                  {activeProjectName || (effectiveProjectId ? "Project Workspace" : "Select Project")}
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-muted transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        )}

        {/* Scrollable Navigation Groups */}
        <div className="flex-1 overflow-y-auto px-2 py-2.5 space-y-3.5 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-hairline">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading} className="space-y-0.5">
              {/* Group Heading (Visible both expanded and collapsed) */}
              {collapsed ? (
                <div className="pt-2 pb-1 px-1 text-center select-none">
                  <div className="mx-auto mb-1.5 h-px w-8 bg-hairline-soft" aria-hidden />
                  <span className="block text-[8.5px] font-extrabold uppercase tracking-wider text-muted/80 truncate">
                    {group.collapsedHeading}
                  </span>
                </div>
              ) : (
                <div className="px-2.5 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted/75 select-none">
                  {group.heading}
                </div>
              )}

              {group.items.map((item) => {
                const href = getHref(item);
                const active = currentKey === item.segment;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.segment}
                    href={href}
                    onClick={closeMobile}
                    onFocus={() => handlePrefetch(href)}
                    onPointerEnter={() => handlePrefetch(href)}
                    aria-current={active ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`group relative flex items-center transition-all ${
                      collapsed
                        ? "h-10 w-10 mx-auto justify-center rounded-xl p-0"
                        : "gap-3 rounded-xl px-2.5 py-2 text-xs"
                    } ${
                      active
                        ? "bg-ink text-canvas font-semibold shadow-xs"
                        : "text-muted hover:bg-surface-soft hover:text-ink font-medium"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-105 ${
                        active ? "text-canvas" : "text-muted group-hover:text-ink"
                      }`}
                    />

                    {!collapsed && (
                      <>
                        <span className="truncate flex-1">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`rounded-pill px-1.5 py-0.2 text-[9px] font-mono font-bold tracking-tight ${
                              active
                                ? "bg-white/20 text-canvas"
                                : "bg-brand-accent/10 text-brand-accent border border-brand-accent/20"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Desktop Collapse Footer Button */}
        <div className="hidden border-t border-hairline/80 p-2 md:block">
          <button
            type="button"
            onClick={toggleCollapse}
            className={`btn-interactive flex w-full items-center gap-2 rounded-xl py-2 text-xs font-medium text-muted transition-colors hover:bg-surface-soft hover:text-ink ${
              collapsed ? "h-9 w-9 mx-auto justify-center p-0" : "px-2.5"
            }`}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse sidebar</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

// Backward compatibility export
export const ProjectSubNav = ProjectRouteSubNav;
