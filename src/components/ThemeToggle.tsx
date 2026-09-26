"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  APP_THEME_CHANGE_EVENT,
  APP_THEME_STORAGE_KEY,
  DEFAULT_APP_THEME,
  LEGACY_APP_THEME_CHANGE_EVENT,
  LEGACY_APP_THEME_STORAGE_KEY,
  applyGlobalTheme,
  isAppTheme,
  readStoredAppTheme,
  type AppTheme,
} from "@/lib/app-theme";

function readTheme(): AppTheme {
  if (typeof document !== "undefined") {
    const docTheme = document.documentElement.dataset.appTheme;
    if (isAppTheme(docTheme)) return docTheme;
    const bodyTheme = document.body.dataset.appTheme;
    if (isAppTheme(bodyTheme)) return bodyTheme;
    const shell = document.querySelector<HTMLElement>(".app-shell");
    const shellTheme = shell?.dataset.appTheme;
    if (isAppTheme(shellTheme)) return shellTheme;
  }
  return readStoredAppTheme();
}

function subscribeTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(APP_THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  const observer = new MutationObserver(callback);
  if (document?.documentElement) {
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-app-theme"],
    });
  }
  return () => {
    window.removeEventListener(APP_THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
    observer.disconnect();
  };
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => DEFAULT_APP_THEME);

  const nextTheme: AppTheme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={() => {
        applyGlobalTheme(nextTheme);
        window.localStorage.setItem(APP_THEME_STORAGE_KEY, nextTheme);
        window.localStorage.setItem(LEGACY_APP_THEME_STORAGE_KEY, nextTheme);
        window.dispatchEvent(new Event(APP_THEME_CHANGE_EVENT));
        window.dispatchEvent(new Event(LEGACY_APP_THEME_CHANGE_EVENT));
      }}
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
