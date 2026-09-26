"use client";

import { useEffect, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { LayoutDashboard } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function UserMenu() {
  const [assistantOpen, setAssistantOpen] = useState(false);

  useEffect(() => {
    const syncAssistantState = (event: Event) => {
      const open = (event as CustomEvent<{ open?: boolean }>).detail?.open;
      if (typeof open === "boolean") setAssistantOpen(open);
    };
    window.addEventListener("agira:assistant-state", syncAssistantState);
    return () => window.removeEventListener("agira:assistant-state", syncAssistantState);
  }, []);

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
          const open = !assistantOpen;
          setAssistantOpen(open);
          window.dispatchEvent(
            new CustomEvent("agira:toggle-assistant", { detail: { open } })
          );
        }}
        aria-pressed={assistantOpen}
        aria-label={assistantOpen ? "Close Agent" : "Open Agent"}
        title={assistantOpen ? "Return to dashboard" : "Open Agent"}
        className={`group inline-flex h-8 items-center gap-1.5 rounded-pill px-3 text-xs font-semibold btn-interactive transition-all ${
          assistantOpen
            ? "border border-ink bg-ink text-canvas shadow-[0_4px_12px_rgba(15,23,42,0.18)]"
            : "border border-hairline bg-surface-soft/90 text-ink shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-brand-accent/40 hover:bg-surface-soft"
        }`}
      >
        <LayoutDashboard size={13} className={`transition-transform duration-150 group-hover:scale-110 ${assistantOpen ? "text-canvas" : "text-brand-accent"}`} aria-hidden />
        <span>{assistantOpen ? "Dashboard" : "AI Agent"}</span>
      </button>
    </div>
  );
}
