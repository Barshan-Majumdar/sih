import { describe, expect, it } from "vitest";
import {
  assistantMonthlyModelLimit,
  minuteWindow,
  monthWindow,
  usageLimitHeaders,
} from "@/lib/assistant-usage";
import { env } from "@/lib/env";

describe("Agent usage policy", () => {
  it("uses stable UTC minute and month windows", () => {
    const now = new Date("2026-07-18T13:42:37.456Z");

    expect(minuteWindow(now)).toEqual({
      windowStart: new Date("2026-07-18T13:42:00.000Z"),
      resetAt: new Date("2026-07-18T13:43:00.000Z"),
    });
    expect(monthWindow(now)).toEqual({
      windowStart: new Date("2026-07-01T00:00:00.000Z"),
      resetAt: new Date("2026-08-01T00:00:00.000Z"),
    });
  });

  it("maps every plan to its configured monthly model allowance", () => {
    expect(assistantMonthlyModelLimit("FREE")).toBe(env.AI_MONTHLY_LIMIT_FREE);
    expect(assistantMonthlyModelLimit("CORE")).toBe(env.AI_MONTHLY_LIMIT_CORE);
    expect(assistantMonthlyModelLimit("PRO")).toBe(env.AI_MONTHLY_LIMIT_PRO);
  });

  it("provides standard rate-limit response headers", () => {
    const headers = usageLimitHeaders({
      allowed: false,
      limit: 30,
      remaining: 0,
      resetAt: new Date(Date.now() + 30_000),
      used: 30,
    });

    expect(headers["X-RateLimit-Limit"]).toBe("30");
    expect(headers["X-RateLimit-Remaining"]).toBe("0");
    expect(headers["X-RateLimit-Reset"]).toMatch(/Z$/);
    expect(Number(headers["Retry-After"])).toBeGreaterThan(0);
  });
});
