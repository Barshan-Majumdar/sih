import { sanitizeMetadata } from "@/lib/telemetry-privacy";

/**
 * Structured logging that is safe to import from a client component.
 *
 * This module must never import a Node core module. The server half lives in
 * lib/observability.ts, which adds the AsyncLocalStorage request store and
 * re-exports everything here. Importing that server module from a client
 * component pulls node:async_hooks into the browser bundle, which webpack
 * refuses outright.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogMetadata = Record<string, unknown>;

/**
 * Supplied by the server module on import. On the client it stays undefined,
 * which is correct: there is no per-request store in the browser.
 */
let requestIdResolver: (() => string | undefined) | undefined;
export function setRequestIdResolver(resolver: () => string | undefined) {
  requestIdResolver = resolver;
}

export function currentRequestId(): string | undefined {
  return requestIdResolver?.();
}

function emit(level: LogLevel, event: string, metadata: LogMetadata = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    severity: level.toUpperCase(),
    service: "agira-web",
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    event,
    requestId: currentRequestId(),
    ...sanitizeMetadata(metadata),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.info(line);
}

export const logger = {
  debug: (event: string, metadata?: LogMetadata) => emit("debug", event, metadata),
  info: (event: string, metadata?: LogMetadata) => emit("info", event, metadata),
  warn: (event: string, metadata?: LogMetadata) => emit("warn", event, metadata),
  error: (event: string, error: unknown, metadata: LogMetadata = {}) => {
    emit("error", event, {
      ...metadata,
      error: error instanceof Error ? error : new Error("Unknown operational failure"),
    });
  },
};

export function reportException(error: unknown, event: string, metadata: LogMetadata = {}) {
  logger.error(event, error, metadata);
}
