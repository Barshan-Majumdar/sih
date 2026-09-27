"use client";

import { Moon, Sun } from "lucide-react";
import { useAppTheme, type AppTheme } from "@/lib/app-theme";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useAppTheme();
  const nextTheme: AppTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={
        className ??
        "group btn-interactive inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-hairline bg-surface-soft/80 text-body shadow-[0_1px_2px_rgba(15,23,42,0.02)] transition-all hover:border-muted-soft/40 hover:bg-surface-soft hover:text-ink"
      }
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <Icon size={15} className="transition-transform duration-300 group-hover:rotate-45" aria-hidden />
    </button>
  );
}

export default ThemeToggle;
