import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { syncOverdueRfiFlags } from "@/lib/rfi-overdue";
import { computeProjectVariance } from "@/lib/portfolio-analytics";
import { createFixture, cleanupFixture, type Fixture } from "./fixtures";

describe("Phase 2 models: SIR, Submittal, RFI, Drawing, Baseline, Activity Log", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it("Schedule Impact Request: submit, then approve with a proposed new end date", async () => {
    const task = await prisma.task.create({
      data: { projectId: fixture.project.id, name: "Excavation", startDate: new Date("2026-01-01"), endDate: new Date("2026-01-10") },
    });

    const sir = await prisma.scheduleImpactRequest.create({
      data: {
        projectId: fixture.project.id,
        taskId: task.id,
        description: "Unforeseen rock in excavation area",
        proposedNewEndDate: new Date("2026-01-15"),
        submittedById: fixture.trade.member.id,
      },
    });
    expect(sir.status).toBe("PENDING");

    const reviewed = await prisma.scheduleImpactRequest.update({
      where: { id: sir.id },
      data: { status: "APPROVED", reviewedById: fixture.pm.member.id, reviewedAt: new Date(), reviewNote: "Approved" },
    });
    expect(reviewed.status).toBe("APPROVED");

    // Mirrors the reviewScheduleImpactRequest action's side effect of pushing the task out.
    if (reviewed.status === "APPROVED" && reviewed.proposedNewEndDate) {
      await prisma.task.update({ where: { id: task.id }, data: { endDate: reviewed.proposedNewEndDate } });
    }
    const updatedTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updatedTask.endDate.toISOString()).toBe(new Date("2026-01-15").toISOString());
  });

  it("Submittal: create then move through the review statuses", async () => {
    const submittal = await prisma.submittal.create({
      data: {
        projectId: fixture.project.id,
        title: "Structural Steel Shop Drawings",
        specSection: "05 12 00",
        submittedById: fixture.trade.member.id,
      },
    });
    expect(submittal.status).toBe("PENDING");

    const revised = await prisma.submittal.update({ where: { id: submittal.id }, data: { status: "REVISE_RESUBMIT" } });
    expect(revised.status).toBe("REVISE_RESUBMIT");

    const approved = await prisma.submittal.update({ where: { id: submittal.id }, data: { status: "APPROVED" } });
    expect(approved.status).toBe("APPROVED");
  });

  it("RFI: an overdue open RFI auto-flags its linked task as a roadblock", async () => {
    const task = await prisma.task.create({
      data: { projectId: fixture.project.id, name: "Set anchor bolts", startDate: new Date("2026-01-01"), endDate: new Date("2026-01-05") },
    });
    expect(task.isRoadblock).toBe(false);

    await prisma.rFI.create({
      data: {
        projectId: fixture.project.id,
        taskId: task.id,
        question: "Confirm anchor bolt spacing per detail 4/S-201",
        dueDate: new Date(Date.now() - 2 * 86_400_000), // yesterday
        raisedById: fixture.trade.member.id,
      },
    });

    await syncOverdueRfiFlags(fixture.project.id);

    const flagged = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(flagged.isRoadblock).toBe(true);
    expect(flagged.roadblockNote).toContain("overdue");

    // Idempotent: running it again shouldn't error or double-flag.
    await syncOverdueRfiFlags(fixture.project.id);
    const stillFlagged = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(stillFlagged.isRoadblock).toBe(true);
  });

  it("RFI: a non-overdue open RFI does not touch its task", async () => {
    const task = await prisma.task.create({
      data: { projectId: fixture.project.id, name: "Order windows", startDate: new Date("2026-01-01"), endDate: new Date("2026-01-05") },
    });
    await prisma.rFI.create({
      data: {
        projectId: fixture.project.id,
        taskId: task.id,
        question: "Confirm window supplier lead time",
        dueDate: new Date(Date.now() + 5 * 86_400_000), // in the future
        raisedById: fixture.trade.member.id,
      },
    });

    await syncOverdueRfiFlags(fixture.project.id);
    const unchanged = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(unchanged.isRoadblock).toBe(false);
  });

  it("Drawing: re-uploading the same title supersedes the prior revision", async () => {
    const v1 = await prisma.drawing.create({
      data: { projectId: fixture.project.id, title: "A-101 Floor Plan", fileUrl: "/uploads/test/v1.pdf", uploadedById: fixture.pm.member.id, revision: 1 },
    });

    const v2 = await prisma.$transaction(async (tx) => {
      await tx.drawing.update({ where: { id: v1.id }, data: { isSuperseded: true } });
      return tx.drawing.create({
        data: { projectId: fixture.project.id, title: "A-101 Floor Plan", fileUrl: "/uploads/test/v2.pdf", uploadedById: fixture.pm.member.id, revision: 2 },
      });
    });

    const refreshedV1 = await prisma.drawing.findUniqueOrThrow({ where: { id: v1.id } });
    expect(refreshedV1.isSuperseded).toBe(true);
    expect(v2.revision).toBe(2);
    expect(v2.isSuperseded).toBe(false);
  });

  it("Baseline: snapshots current task dates, then detects a later schedule slip", async () => {
    const task = await prisma.task.create({
      data: { projectId: fixture.project.id, name: "Drywall", startDate: new Date("2026-05-01"), endDate: new Date("2026-05-10") },
    });

    const baseline = await prisma.baseline.create({
      data: {
        projectId: fixture.project.id,
        name: "Original Schedule",
        createdById: fixture.pm.member.id,
        snapshots: {
          create: [{ taskId: task.id, taskName: task.name, startDate: task.startDate, endDate: task.endDate, status: task.status }],
        },
      },
      include: { snapshots: true },
    });

    const slippedEnd = new Date(task.endDate.getTime() + 4 * 86_400_000);
    await prisma.task.update({ where: { id: task.id }, data: { endDate: slippedEnd } });

    const currentEndDateByTaskId = new Map([[task.id, slippedEnd]]);
    const variance = computeProjectVariance(baseline.snapshots, currentEndDateByTaskId);
    expect(variance).toBe(4);
  });

  it("Activity Log: entries are queryable in reverse-chronological order by project", async () => {
    await logActivity({ projectId: fixture.project.id, userId: fixture.pm.user.id, action: "test_first", detail: "first" });
    await new Promise((r) => setTimeout(r, 10));
    await logActivity({ projectId: fixture.project.id, userId: fixture.pm.user.id, action: "test_second", detail: "second" });

    const entries = await prisma.activityLogEntry.findMany({
      where: { projectId: fixture.project.id, action: { in: ["test_first", "test_second"] } },
      orderBy: { createdAt: "desc" },
    });
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe("test_second");
    expect(entries[1].action).toBe("test_first");
  });
});
