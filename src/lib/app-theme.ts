export type AppTheme = "light" | "dark";

/** Light is always the product default. Dark is opt-in via the in-app toggle. */
export const DEFAULT_APP_THEME: AppTheme = "light";

export const APP_THEME_STORAGE_KEY = "agira:theme";
export const APP_THEME_CHANGE_EVENT = "agira:theme-change";

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value === "light" || value === "dark";
}

export function readStoredAppTheme(): AppTheme {
  if (typeof window === "undefined") return DEFAULT_APP_THEME;
  try {
    const stored = window.localStorage.getItem(APP_THEME_STORAGE_KEY);
    return isAppTheme(stored) ? stored : DEFAULT_APP_THEME;
  } catch {
    return DEFAULT_APP_THEME;
  }
}

export function applyAppShellTheme(shell: HTMLElement, theme: AppTheme) {
  shell.dataset.appTheme = theme;
  shell.style.colorScheme = theme;
}
