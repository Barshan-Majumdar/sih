"use client";

import React, { useSyncExternalStore } from "react";
import TechText from "./TechText";
import {
  APP_THEME_CHANGE_EVENT,
  DEFAULT_APP_THEME,
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

export function InfraTrackWatermark() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => DEFAULT_APP_THEME);
  const isDark = theme === "dark";

  return (
    <div
      className="relative mx-auto flex w-full max-w-[1900px] select-none items-center justify-center overflow-hidden py-4 sm:py-6"
      style={{ width: "100%", height: "540px", position: "relative" }}
      role="figure"
      aria-label="InfraTrack"
    >
      <TechText
        text="InfraTrack"
        fontWeight={700}
        fontSize={240}
        reveal="letter"
        dashLength={5}
        dashGap={2.5}
        specks={18}
        sweep={true}
        speed={1.0}
        color={isDark ? "#ffffff" : "#0f172a"}
        accentColor={isDark ? "#3b82f6" : "#2563eb"}
      />
    </div>
  );
}

export default InfraTrackWatermark;
