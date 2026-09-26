"use client";

import Link from "next/link";
import { AppNavLinks } from "@/components/AppNavLinks";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { UserMenu } from "@/components/UserMenu";
import { AgiraMark } from "@/components/landing/AgiraMark";
import { PanelLeft, Sparkles } from "lucide-react";

export function NavBar() {
  const handleToggleSidebar = () => {
    window.dispatchEvent(new CustomEvent("agira:toggle-sidebar"));
  };

  const handleToggleAssistant = () => {
    window.dispatchEvent(new CustomEvent("agira:toggle-assistant"));
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-hairline/80 bg-canvas/95 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Sidebar Toggle Button */}
        <button
          type="button"
          onClick={handleToggleSidebar}
          className="btn-interactive inline-flex h-9 w-9 items-center justify-center rounded-xl border border-hairline bg-surface-soft text-muted transition-colors hover:border-hairline-strong hover:bg-canvas hover:text-ink"
          aria-label="Toggle navigation sidebar"
          title="Toggle sidebar (Ctrl+B)"
        >
          <PanelLeft className="h-4 w-4" />
        </button>

        {/* Brand Home Link */}
        <Link
          href="/dashboard"
          className="group inline-flex min-w-0 shrink-0 items-center gap-2.5 transition-opacity hover:opacity-85"
          aria-label="Agira home"
        >
          <AgiraMark size={22} />
          <span className="font-display text-sm font-bold tracking-tight text-ink sm:inline-block">
            Agira
          </span>
        </Link>

        <div className="hidden h-5 w-px bg-hairline md:block" aria-hidden />

        <div className="hidden md:block">
          <AppNavLinks />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Ask AI Copilot Button */}
        <button
          type="button"
          onClick={handleToggleAssistant}
          className="btn-interactive hidden items-center gap-1.5 rounded-xl border border-hairline bg-surface-soft/90 px-3 py-1.5 text-xs font-semibold text-ink shadow-2xs transition-all hover:border-brand-accent/40 hover:bg-surface-soft sm:inline-flex"
          title="Open AI Schedule Copilot (Cmd+K)"
        >
          <Sparkles className="h-3.5 w-3.5 text-brand-accent" />
          <span>Ask Agira AI</span>
          <kbd className="ml-1 rounded border border-hairline bg-canvas px-1.5 py-0.2 text-[10px] font-mono text-muted">
            ⌘K
          </kbd>
        </button>

        <OrgSwitcher />
        <span className="hidden h-6 w-px bg-hairline-soft sm:block" aria-hidden />
        <UserMenu />
      </div>
    </header>
  );
}
