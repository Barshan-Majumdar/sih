"use client";

import { useLayoutEffect, type ReactNode } from "react";
import {
  APP_THEME_CHANGE_EVENT,
  applyAppShellTheme,
  readStoredAppTheme,
} from "@/lib/app-theme";

/**
 * Syncs the user's saved theme onto `.app-shell` only.
 * Default is light; dark applies only after an explicit toggle.
 * Marketing pages sit outside this tree and stay light.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  useLayoutEffect(() => {
    const shell = document.querySelector<HTMLElement>(".app-shell");
    if (!shell) return;

    const sync = () => applyAppShellTheme(shell, readStoredAppTheme());
    sync();

    window.addEventListener(APP_THEME_CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(APP_THEME_CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return children;
}
