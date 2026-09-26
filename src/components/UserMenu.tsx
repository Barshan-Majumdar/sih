"use client";

import { usePathname, useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function UserMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const isAgent = pathname === "/agent" || pathname.startsWith("/agent/");

  return (
    <div className="flex items-center gap-2">
      <UserButton
        appearance={{
          elements: {
            avatarBox: "h-8 w-8 rounded-full ring-1 ring-hairline shadow-sm transition-transform hover:scale-105",
          },
        }}
      />

      <ThemeToggle />

      <button
        type="button"
        onClick={() => {
          if (isAgent) {
            router.push("/dashboard");
          } else {
            router.push("/agent");
          }
        }}
        aria-pressed={isAgent}
        aria-label={isAgent ? "Return to Dashboard" : "Open Agent"}
        title={isAgent ? "Return to dashboard" : "Open Agent"}
        className={`group inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-xs font-semibold btn-interactive transition-all ${
          isAgent
            ? "border border-ink bg-ink text-canvas shadow-[0_4px_12px_rgba(15,23,42,0.18)]"
            : "border border-hairline bg-surface-soft/90 text-ink shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-brand-accent/40 hover:bg-surface-soft"
        }`}
      >
        <LayoutDashboard size={13} className={`transition-transform duration-150 group-hover:scale-110 ${isAgent ? "text-canvas" : "text-brand-accent"}`} aria-hidden />
        <span>{isAgent ? "Dashboard" : "AI Agent"}</span>
      </button>
    </div>
  );
}
