import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getWeekStart } from "@/lib/utils";
import { computePpcTrend } from "@/lib/analytics";
import { createFixture, cleanupFixture, type Fixture } from "./fixtures";

describe("Weekly Work Plan commitments + PPC (real DB round trip)", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it("commits a task to a week, then marks it complete, and PPC reflects it", async () => {
    const task = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Pour slab",
        assignedToId: fixture.trade.member.id,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-04-03"),
      },
    });
    const weekStart = getWeekStart(new Date("2026-04-01"));

    const commitment = await prisma.weeklyCommitment.create({
      data: { taskId: task.id, weekStartDate: weekStart, committedById: fixture.trade.member.id },
    });
    expect(commitment.status).toBe("COMMITTED");

    // Duplicate commitment for the same task+week is rejected by the unique constraint.
    await expect(
      prisma.weeklyCommitment.create({ data: { taskId: task.id, weekStartDate: weekStart, committedById: fixture.trade.member.id } })
    ).rejects.toThrow();

    const completed = await prisma.weeklyCommitment.update({
      where: { id: commitment.id },
      data: { status: "COMPLETED" },
    });
    expect(completed.status).toBe("COMPLETED");

    const allCommitments = await prisma.weeklyCommitment.findMany({ where: { task: { projectId: fixture.project.id } } });
    const trend = computePpcTrend(allCommitments);
    expect(trend).toHaveLength(1);
    expect(trend[0].ppc).toBe(100);
  });

  it("records a reason for variance when a commitment is not completed", async () => {
    const task = await prisma.task.create({
      data: { projectId: fixture.project.id, name: "Install rebar", startDate: new Date("2026-04-08"), endDate: new Date("2026-04-10") },
    });
    const weekStart = getWeekStart(new Date("2026-04-08"));
    const commitment = await prisma.weeklyCommitment.create({
      data: { taskId: task.id, weekStartDate: weekStart, committedById: fixture.pm.member.id },
    });

    const notCompleted = await prisma.weeklyCommitment.update({
      where: { id: commitment.id },
      data: { status: "NOT_COMPLETED", reasonForVariance: "Material delivery delayed" },
    });
    expect(notCompleted.status).toBe("NOT_COMPLETED");
    expect(notCompleted.reasonForVariance).toBe("Material delivery delayed");
  });
});
