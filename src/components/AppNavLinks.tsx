"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/projects", label: "Projects", match: (path: string) => path.startsWith("/projects") },
  {
    href: "/dashboard",
    label: "Portfolio",
    match: (path: string) => path === "/dashboard" || path === "/timeline" || path === "/trade-performance",
  },
  { href: "/integrations", label: "Integrations", match: (path: string) => path === "/integrations" },
  { href: "/plan", label: "Plan", match: (path: string) => path === "/plan" },
];

export function AppNavLinks({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={mobile ? "Mobile navigation" : "Primary navigation"}
      className={mobile ? "flex min-w-max items-center gap-1 px-2" : "hidden items-center gap-1 md:flex"}
    >
      {LINKS.map((link) => {
        const active = link.match(pathname);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-8 items-center rounded-pill border px-3 text-xs font-semibold transition-colors sm:px-3.5 ${
              active
                ? "border-ink bg-ink text-canvas shadow-[0_1px_3px_rgba(17,17,17,0.14)]"
                : "border-hairline-soft bg-canvas text-muted hover:border-hairline hover:bg-surface-soft hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
