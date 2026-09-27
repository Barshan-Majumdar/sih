import { useSyncExternalStore } from "react";

export type AppTheme = "light" | "dark";

/** Light is always the product default. Dark is opt-in via the in-app toggle. */
export const DEFAULT_APP_THEME: AppTheme = "light";

export const APP_THEME_STORAGE_KEY = "infratrack:theme";
export const LEGACY_APP_THEME_STORAGE_KEY = "agira:theme";
export const APP_THEME_CHANGE_EVENT = "infratrack:theme-change";
export const LEGACY_APP_THEME_CHANGE_EVENT = "agira:theme-change";

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value === "light" || value === "dark";
}

export function readStoredAppTheme(): AppTheme {
  if (typeof window === "undefined") return DEFAULT_APP_THEME;
  try {
    const stored =
      window.localStorage.getItem(APP_THEME_STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_APP_THEME_STORAGE_KEY);
    return isAppTheme(stored) ? stored : DEFAULT_APP_THEME;
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export function readCurrentTheme(): AppTheme {
  if (typeof document !== "undefined") {
    if (document.documentElement.classList.contains("dark")) return "dark";
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

export function subscribeCurrentTheme(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(APP_THEME_CHANGE_EVENT, callback);
  window.addEventListener(LEGACY_APP_THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  const observer = new MutationObserver(callback);
  if (document?.documentElement) {
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-app-theme", "class"],
    });
  }
  return () => {
    window.removeEventListener(APP_THEME_CHANGE_EVENT, callback);
    window.removeEventListener(LEGACY_APP_THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
    observer.disconnect();
  };
}

export function useAppTheme() {
  const theme = useSyncExternalStore(subscribeCurrentTheme, readCurrentTheme, () => DEFAULT_APP_THEME);
  const isDark = theme === "dark";
  const toggleTheme = () => {
    const nextTheme: AppTheme = isDark ? "light" : "dark";
    applyGlobalTheme(nextTheme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, nextTheme);
      window.localStorage.setItem(LEGACY_APP_THEME_STORAGE_KEY, nextTheme);
      window.dispatchEvent(new Event(APP_THEME_CHANGE_EVENT));
      window.dispatchEvent(new Event(LEGACY_APP_THEME_CHANGE_EVENT));
    }
  };
  return { theme, isDark, toggleTheme };
}

export function applyGlobalTheme(theme: AppTheme) {
  if (typeof document !== "undefined") {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      document.documentElement.dataset.appTheme = "dark";
      document.documentElement.style.colorScheme = "dark";
      document.body.dataset.appTheme = "dark";
      document.body.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      delete document.documentElement.dataset.appTheme;
      document.documentElement.style.colorScheme = "light";
      delete document.body.dataset.appTheme;
      document.body.style.colorScheme = "light";
    }

    const shell = document.querySelector<HTMLElement>(".app-shell");
    if (shell) {
      if (theme === "dark") {
        shell.classList.add("dark");
        shell.dataset.appTheme = "dark";
        shell.style.colorScheme = "dark";
      } else {
        shell.classList.remove("dark");
        delete shell.dataset.appTheme;
        shell.style.colorScheme = "light";
      }
    }
  }
}

export function applyAppShellTheme(shell: HTMLElement, theme: AppTheme) {
  applyGlobalTheme(theme);
}
