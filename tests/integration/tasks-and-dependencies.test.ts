import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { computeCriticalPath, wouldCreateCycle } from "@/lib/critical-path";
import { createFixture, cleanupFixture, type Fixture } from "./fixtures";

describe("Tasks, roadblocks, and dependencies (real DB round trip)", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it("creates a task and updates its status", async () => {
    const task = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Rough electrical",
        assignedToId: fixture.trade.member.id,
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-12"),
        status: "NOT_STARTED",
      },
    });
    expect(task.status).toBe("NOT_STARTED");

    const updated = await prisma.task.update({ where: { id: task.id }, data: { status: "IN_PROGRESS" } });
    expect(updated.status).toBe("IN_PROGRESS");
  });

  it("flags a task as a roadblock and then resolves it", async () => {
    const task = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Rough plumbing",
        startDate: new Date("2026-01-05"),
        endDate: new Date("2026-01-12"),
      },
    });

    const flagged = await prisma.task.update({
      where: { id: task.id },
      data: {
        isRoadblock: true,
        roadblockStatus: "OPEN",
        roadblockNote: "Waiting on permit",
        roadblockType: "INSPECTION",
        roadblockOwnerId: fixture.superintendent.member.id,
        roadblockDueDate: new Date("2026-01-10"),
        roadblockRaisedBy: fixture.trade.user.id,
      },
    });
    expect(flagged.isRoadblock).toBe(true);
    expect(flagged.roadblockStatus).toBe("OPEN");

    const resolved = await prisma.task.update({
      where: { id: task.id },
      data: { roadblockStatus: "RESOLVED", resolvedAt: new Date() },
    });
    expect(resolved.roadblockStatus).toBe("RESOLVED");
    expect(resolved.resolvedAt).not.toBeNull();
  });

  it("adds a dependency, rejects a cycle, computes critical path, then removes the dependency", async () => {
    const a = await prisma.task.create({
      data: { projectId: fixture.project.id, name: "Foundation", startDate: new Date("2026-02-01"), endDate: new Date("2026-02-05") },
    });
    const b = await prisma.task.create({
      data: { projectId: fixture.project.id, name: "Framing", startDate: new Date("2026-02-05"), endDate: new Date("2026-02-10") },
    });

    const existingEdges = await prisma.taskDependency.findMany({
      where: { predecessor: { projectId: fixture.project.id } },
      select: { predecessorId: true, successorId: true },
    });
    expect(wouldCreateCycle(existingEdges, a.id, b.id)).toBe(false);

    const dependency = await prisma.taskDependency.create({
      data: { predecessorId: a.id, successorId: b.id },
    });
    expect(dependency.predecessorId).toBe(a.id);

    // Now that a -> b exists, proposing b -> a would create a cycle.
    const edgesAfterAdd = await prisma.taskDependency.findMany({
      where: { predecessor: { projectId: fixture.project.id } },
      select: { predecessorId: true, successorId: true },
    });
    expect(wouldCreateCycle(edgesAfterAdd, b.id, a.id)).toBe(true);

    const critical = computeCriticalPath(
      [
        { id: a.id, startDate: a.startDate, endDate: a.endDate },
        { id: b.id, startDate: b.startDate, endDate: b.endDate },
      ],
      edgesAfterAdd
    );
    expect(critical.has(a.id)).toBe(true);
    expect(critical.has(b.id)).toBe(true);

    await prisma.taskDependency.delete({ where: { id: dependency.id } });
    const remaining = await prisma.taskDependency.findMany({ where: { id: dependency.id } });
    expect(remaining).toHaveLength(0);
  });

  it("enforces the unique constraint preventing a duplicate predecessor/successor pair", async () => {
    const a = await prisma.task.create({
      data: { projectId: fixture.project.id, name: "Task A", startDate: new Date("2026-03-01"), endDate: new Date("2026-03-03") },
    });
    const b = await prisma.task.create({
      data: { projectId: fixture.project.id, name: "Task B", startDate: new Date("2026-03-03"), endDate: new Date("2026-03-05") },
    });
    await prisma.taskDependency.create({ data: { predecessorId: a.id, successorId: b.id } });

    await expect(prisma.taskDependency.create({ data: { predecessorId: a.id, successorId: b.id } })).rejects.toThrow();
  });
});
