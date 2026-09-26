"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  {
    href: "/dashboard",
    label: "Dashboard",
    match: (path: string) =>
      path === "/dashboard" ||
      path.startsWith("/dashboard/") ||
      path === "/timeline" ||
      path === "/trade-performance",
  },
  {
    href: "/projects",
    label: "Projects",
    match: (path: string) => path === "/projects" || path.startsWith("/projects/"),
  },
  { href: "/integrations", label: "Integrations", match: (path: string) => path === "/integrations" },
  { href: "/plan", label: "Plan", match: (path: string) => path === "/plan" },
];

export function AppNavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Primary navigation"}
      className={mobile ? "flex min-w-max items-center gap-1.5 px-2" : "hidden items-center gap-1.5 md:flex"}
    >
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`btn-interactive inline-flex h-8 items-center rounded-pill px-3.5 text-xs font-semibold tracking-tight transition-all ${
              active
                ? "border border-ink bg-ink text-canvas shadow-[0_2px_6px_rgba(15,23,42,0.14)]"
                : "border border-transparent text-muted hover:border-hairline hover:bg-surface-soft hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
