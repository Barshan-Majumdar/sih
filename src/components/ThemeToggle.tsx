"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  APP_THEME_CHANGE_EVENT,
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME,
  LEGACY_APP_THEME_CHANGE_EVENT,
  LEGACY_APP_THEME_STORAGE_KEY,
  applyAppShellTheme,
  isAppTheme,
  type AppTheme,
} from "@/lib/app-theme";

function applyTheme(theme: AppTheme) {
  const shell = document.querySelector<HTMLElement>(".app-shell");
  if (shell) applyAppShellTheme(shell, theme);
}

function readTheme(): AppTheme {
  const shell = document.querySelector<HTMLElement>(".app-shell");
  const shellTheme = shell?.dataset.appTheme;
  if (isAppTheme(shellTheme)) return shellTheme;

  try {
    const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    return isAppTheme(stored) ? stored : DEFAULT_APP_THEME;
  } catch {
    return DEFAULT_APP_THEME;
  }
}

function subscribeTheme(callback: () => void) {
  window.addEventListener(APP_THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(APP_THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => DEFAULT_APP_THEME);

  const nextTheme: AppTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => {
        applyTheme(nextTheme);
        window.localStorage.setItem(APP_THEME_STORAGE_KEY, nextTheme);
        window.localStorage.setItem(LEGACY_APP_THEME_STORAGE_KEY, nextTheme);
        window.dispatchEvent(new Event(APP_THEME_CHANGE_EVENT));
        window.dispatchEvent(new Event(LEGACY_APP_THEME_CHANGE_EVENT));
      }}
      className="group btn-interactive inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-hairline bg-surface-soft/80 text-body shadow-[0_1px_2px_rgba(15,23,42,0.02)] transition-all hover:border-muted-soft/40 hover:bg-surface-soft hover:text-ink"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <Icon size={14} className="transition-transform duration-300 group-hover:rotate-45" aria-hidden />
    </button>
  );
}
