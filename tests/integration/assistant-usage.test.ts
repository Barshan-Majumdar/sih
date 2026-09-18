import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import {
  ASSISTANT_USAGE_KIND,
  consumeAssistantUsageWindow,
} from "@/lib/assistant-usage";
import { prisma } from "@/lib/prisma";

const testSubjectIds: string[] = [];

afterAll(async () => {
  await prisma.assistantUsageWindow.deleteMany({
    where: { subjectId: { in: testSubjectIds } },
  });
});

describe("Agent usage windows", () => {
  it("atomically refuses concurrent requests after the fixed-window limit", async () => {
    const subjectId = `usage-test-${randomUUID()}`;
    testSubjectIds.push(subjectId);
    const windowStart = new Date("2026-07-18T18:00:00.000Z");
    const resetAt = new Date("2026-07-18T18:01:00.000Z");

    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        consumeAssistantUsageWindow({
          kind: ASSISTANT_USAGE_KIND.USER_MINUTE,
          subjectId,
          windowStart,
          resetAt,
          limit: 3,
        })
      )
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(3);
    expect(results.filter((result) => !result.allowed)).toHaveLength(3);
    expect(results.every((result) => result.remaining >= 0)).toBe(true);

    const persisted = await prisma.assistantUsageWindow.findUniqueOrThrow({
      where: {
        kind_subjectId_windowStart: {
          kind: ASSISTANT_USAGE_KIND.USER_MINUTE,
          subjectId,
          windowStart,
        },
      },
    });
    expect(persisted.count).toBe(3);
  });
});
