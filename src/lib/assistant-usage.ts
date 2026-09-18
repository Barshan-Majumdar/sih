import { randomUUID } from "node:crypto";
import { Prisma, type PlanTier } from "@prisma/client";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const ASSISTANT_USAGE_KIND = {
  USER_MINUTE: "USER_MINUTE",
  ORGANIZATION_MONTH: "ORGANIZATION_MONTH",
} as const;

type AssistantUsageKind = (typeof ASSISTANT_USAGE_KIND)[keyof typeof ASSISTANT_USAGE_KIND];

export type AssistantUsageResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  used: number;
};

type ConsumeUsageWindowInput = {
  kind: AssistantUsageKind;
  subjectId: string;
  windowStart: Date;
  resetAt: Date;
  limit: number;
};

export function minuteWindow(now: Date) {
  const windowStart = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  return { windowStart, resetAt: new Date(windowStart.getTime() + 60_000) };
}

export function monthWindow(now: Date) {
  const windowStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { windowStart, resetAt };
}

export function assistantMonthlyModelLimit(planTier: PlanTier): number {
  if (planTier === "PRO") return env.AI_MONTHLY_LIMIT_PRO;
  if (planTier === "CORE") return env.AI_MONTHLY_LIMIT_CORE;
  return env.AI_MONTHLY_LIMIT_FREE;
}

/**
 * Atomically reserves one request without ever incrementing beyond the limit.
 * The conditional ON CONFLICT update keeps this safe across concurrent Vercel
 * instances without requiring an in-memory cache or a separate Redis service.
 */
export async function consumeAssistantUsageWindow({
  kind,
  subjectId,
  windowStart,
  resetAt,
  limit,
}: ConsumeUsageWindowInput): Promise<AssistantUsageResult> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    INSERT INTO "assistant_usage_window"
      ("id", "kind", "subjectId", "windowStart", "count", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${kind}, ${subjectId}, ${windowStart}, 1, NOW(), NOW())
    ON CONFLICT ("kind", "subjectId", "windowStart")
    DO UPDATE SET
      "count" = "assistant_usage_window"."count" + 1,
      "updatedAt" = NOW()
    WHERE "assistant_usage_window"."count" < ${limit}
    RETURNING "count"
  `);
  const used = rows[0]?.count ?? limit;
  return {
    allowed: rows.length > 0,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt,
    used,
  };
}

export function consumeAssistantBurstLimit(userId: string, now = new Date()) {
  const window = minuteWindow(now);
  return consumeAssistantUsageWindow({
    kind: ASSISTANT_USAGE_KIND.USER_MINUTE,
    subjectId: userId,
    ...window,
    limit: env.AI_CHAT_RATE_LIMIT_PER_MINUTE,
  });
}

export function consumeAssistantModelQuota(
  organizationId: string,
  planTier: PlanTier,
  now = new Date()
) {
  const window = monthWindow(now);
  return consumeAssistantUsageWindow({
    kind: ASSISTANT_USAGE_KIND.ORGANIZATION_MONTH,
    subjectId: organizationId,
    ...window,
    limit: assistantMonthlyModelLimit(planTier),
  });
}

export function usageLimitHeaders(result: AssistantUsageResult) {
  return {
    "Retry-After": String(Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000))),
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": result.resetAt.toISOString(),
  };
}
