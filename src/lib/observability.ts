import { AsyncLocalStorage } from "node:async_hooks";
import {
  currentRequestId,
  logger,
  reportException,
  setRequestIdResolver,
} from "@/lib/observability-core";

/**
 * Server-only observability: the per-request store plus the API request
 * wrapper. Everything reusable lives in lib/observability-core.ts.
 *
 * Do NOT import this module from a client component. It pulls in
 * node:async_hooks, which webpack cannot resolve for the browser target and
 * which fails the dev build. Client code imports observability-core directly.
 */

const requestStore = new AsyncLocalStorage<{ requestId: string }>();
setRequestIdResolver(() => requestStore.getStore()?.requestId);

export { currentRequestId, logger, reportException };
export type { LogLevel, LogMetadata } from "@/lib/observability-core";

export function requestIdFor(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && /^[A-Za-z0-9._:-]{8,128}$/.test(supplied) ? supplied : crypto.randomUUID();
}

export async function observeApiRequest(
  request: Request,
  event: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const requestId = requestIdFor(request);
  return requestStore.run({ requestId }, async () => {
    const startedAt = performance.now();
    logger.info(`${event}.started`, { method: request.method });
    try {
      const response = await handler();
      response.headers.set("X-Request-ID", requestId);
      const metadata = {
        method: request.method,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      };
      if (response.status >= 500) logger.error(`${event}.completed`, new Error("Request returned 5xx"), metadata);
      else if (response.status >= 400) logger.warn(`${event}.completed`, metadata);
      else logger.info(`${event}.completed`, metadata);
      return response;
    } catch (error) {
      reportException(error, `${event}.failed`, {
        method: request.method,
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw error;
    }
  });
}
