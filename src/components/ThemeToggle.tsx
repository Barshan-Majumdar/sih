"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  APP_THEME_CHANGE_EVENT,
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME,
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
        window.dispatchEvent(new Event(APP_THEME_CHANGE_EVENT));
      }}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-pill border border-hairline-soft bg-canvas text-body transition-colors hover:border-hairline hover:bg-surface-soft hover:text-ink"
      aria-label={`Switch to ${nextTheme} mode`}
      title={`Switch to ${nextTheme} mode`}
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}
