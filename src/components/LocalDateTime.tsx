"use client";

import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => undefined;

const DEFAULT_OPTIONS: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
};

/**
 * Formats an instant in the viewer's local timezone.
 * Server Components render in the server TZ (often UTC on Vercel), so
 * wall-clock timestamps must be formatted in the browser.
 */
export function LocalDateTime({
  value,
  options,
  className,
}: {
  value: string | Date;
  options?: Intl.DateTimeFormatOptions;
  className?: string;
}) {
  const iso = typeof value === "string" ? value : value.toISOString();
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const label = mounted
    ? new Date(iso).toLocaleString("en-US", { ...DEFAULT_OPTIONS, ...options })
    : "";

  return (
    <time dateTime={iso} className={className}>
      {label || "\u00a0"}
    </time>
  );
}
