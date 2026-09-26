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

export function applyGlobalTheme(theme: AppTheme) {
  if (typeof document !== "undefined") {
    if (theme === "dark") {
      document.documentElement.dataset.appTheme = "dark";
      document.documentElement.style.colorScheme = "dark";
      document.body.dataset.appTheme = "dark";
      document.body.style.colorScheme = "dark";
    } else {
      delete document.documentElement.dataset.appTheme;
      document.documentElement.style.colorScheme = "light";
      delete document.body.dataset.appTheme;
      document.body.style.colorScheme = "light";
    }

    const shell = document.querySelector<HTMLElement>(".app-shell");
    if (shell) {
      if (theme === "dark") {
        shell.dataset.appTheme = "dark";
        shell.style.colorScheme = "dark";
      } else {
        delete shell.dataset.appTheme;
        shell.style.colorScheme = "light";
      }
    }
  }
}

export function applyAppShellTheme(shell: HTMLElement, theme: AppTheme) {
  applyGlobalTheme(theme);
}
