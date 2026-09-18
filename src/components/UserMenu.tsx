"use client";

import { useEffect, useState } from "react";
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
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
      <SignedIn>
        <UserButton
          appearance={{
            elements: {
              avatarBox: "h-8 w-8 rounded-full ring-1 ring-slate-700",
            },
          }}
        />
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="h-8 rounded-full bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-500">
            Sign in
          </button>
        </SignInButton>
      </SignedOut>

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
        className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors ${
          assistantOpen
            ? "bg-blue-600 text-white shadow-sm"
            : "border border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500 hover:text-white"
        }`}
      >
        <LayoutDashboard size={14} aria-hidden />
        <span>{assistantOpen ? "Dashboard" : "AI Agent"}</span>
      </button>
    </div>
  );
}
