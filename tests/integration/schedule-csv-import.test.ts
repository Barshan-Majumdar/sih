import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The action is called directly here, outside a Next request, so the two
// framework touchpoints it has are stubbed: the session it reads the actor
// from, and the cache revalidation it fires on success.
const session = vi.hoisted(() => ({ userId: "" }));
vi.mock("@/lib/session", () => ({
  requireUser: async () => ({ id: session.userId }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { importScheduleCsv } from "@/app/actions/schedule-import";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

const HEADER = "Task Name,Assignee Email,Start Date,End Date,Status,Progress %,Predecessors";

function csv(...rows: string[]): string {
  return [HEADER, ...rows, ""].join("\n");
}

function day(date: Date): string {
  return date.toISOString().slice(0, 10);
}

describe("Schedule CSV import (real DB round trip)", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
    session.userId = fixture.pm.user.id;
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  function projectTasks() {
    return prisma.task.findMany({
      where: { projectId: fixture.project.id },
      orderBy: { sequenceOrder: "asc" },
    });
  }

  function projectDependencies() {
    return prisma.taskDependency.findMany({
      where: { predecessor: { projectId: fixture.project.id } },
      select: { predecessorId: true, successorId: true },
    });
  }

  /** The three-row schedule the first few tests import and re-import. */
  function baseCsv(excavationEnd = "2026-03-20") {
    return csv(
      `Site Mobilization,${fixture.superintendent.user.email},2026-03-02,2026-03-06,DONE,100,`,
      `Excavation,${fixture.trade.user.email},2026-03-09,${excavationEnd},IN_PROGRESS,40,Site Mobilization`,
      `Footing Formwork,${fixture.trade.user.email},2026-03-23,2026-03-27,NOT_STARTED,0,Excavation;Site Mobilization`
    );
  }

  it("imports a clean file with dates, assignees, statuses and dependency edges", async () => {
    const result = await importScheduleCsv({ projectId: fixture.project.id, csvText: baseCsv() });
    expect(result).toMatchObject({
      success: true,
      data: { created: 3, updated: 0, dependenciesCreated: 3 },
    });

    const tasks = await projectTasks();
    expect(tasks.map((task) => task.name)).toEqual([
      "Site Mobilization",
      "Excavation",
      "Footing Formwork",
    ]);

    const byName = new Map(tasks.map((task) => [task.name, task]));
    const mobilization = byName.get("Site Mobilization")!;
    expect(day(mobilization.startDate)).toBe("2026-03-02");
    expect(day(mobilization.endDate)).toBe("2026-03-06");
    expect(mobilization.status).toBe("DONE");
    expect(mobilization.progress).toBe(100);
    expect(mobilization.assignedToId).toBe(fixture.superintendent.member.id);

    const excavation = byName.get("Excavation")!;
    expect(excavation.status).toBe("IN_PROGRESS");
    expect(excavation.progress).toBe(40);
    expect(excavation.assignedToId).toBe(fixture.trade.member.id);

    const edges = await projectDependencies();
    expect(edges).toHaveLength(3);
    expect(edges).toEqual(
      expect.arrayContaining([
        { predecessorId: mobilization.id, successorId: excavation.id },
        { predecessorId: excavation.id, successorId: byName.get("Footing Formwork")!.id },
        { predecessorId: mobilization.id, successorId: byName.get("Footing Formwork")!.id },
      ])
    );

    const logged = await prisma.activityLogEntry.findFirst({
      where: { projectId: fixture.project.id, action: "schedule_imported" },
    });
    expect(logged?.detail).toContain("3 new");
  });

  it("is idempotent: re-uploading the same file duplicates nothing", async () => {
    const before = await projectTasks();

    const result = await importScheduleCsv({ projectId: fixture.project.id, csvText: baseCsv() });
    expect(result).toMatchObject({
      success: true,
      data: { created: 0, updated: 3, dependenciesCreated: 0 },
    });

    const after = await projectTasks();
    expect(after.map((task) => task.id)).toEqual(before.map((task) => task.id));
    expect(await projectDependencies()).toHaveLength(3);
  });

  it("updates an existing task in place when a date changes", async () => {
    const before = await projectTasks();

    const result = await importScheduleCsv({
      projectId: fixture.project.id,
      csvText: baseCsv("2026-03-24"),
    });
    expect(result).toMatchObject({ success: true, data: { created: 0, updated: 3 } });

    const after = await projectTasks();
    expect(after).toHaveLength(before.length);

    const excavation = after.find((task) => task.name === "Excavation")!;
    expect(excavation.id).toBe(before.find((task) => task.name === "Excavation")!.id);
    expect(day(excavation.endDate)).toBe("2026-03-24");
  });

  it("imports nothing when a single row is invalid", async () => {
    const before = await projectTasks();

    const result = await importScheduleCsv({
      projectId: fixture.project.id,
      csvText: csv(
        `Slab Prep,${fixture.trade.user.email},2026-04-01,2026-04-03,NOT_STARTED,0,`,
        `Slab Pour,${fixture.trade.user.email},2026-04-10,2026-04-06,NOT_STARTED,0,Slab Prep`
      ),
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected the import to be rejected");
    expect(result.error).toContain("Line 3");

    const after = await projectTasks();
    expect(after.map((task) => task.id)).toEqual(before.map((task) => task.id));
    expect(after.some((task) => task.name === "Slab Prep")).toBe(false);
  });

  it("rejects and rolls back a file that closes a cycle through an existing dependency", async () => {
    const alpha = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Punch List",
        startDate: new Date("2026-05-01T00:00:00.000Z"),
        endDate: new Date("2026-05-05T00:00:00.000Z"),
      },
    });
    const beta = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Final Clean",
        startDate: new Date("2026-05-06T00:00:00.000Z"),
        endDate: new Date("2026-05-08T00:00:00.000Z"),
      },
    });
    // Already in the database: Final Clean must precede Punch List.
    await prisma.taskDependency.create({ data: { predecessorId: beta.id, successorId: alpha.id } });

    const edgesBefore = await projectDependencies();

    // The file's own graph is acyclic, but Punch List -> Final Clean closes the
    // loop against the edge that is already stored.
    const result = await importScheduleCsv({
      projectId: fixture.project.id,
      csvText: csv(
        `Punch List,,2026-05-11,2026-05-15,NOT_STARTED,0,`,
        `Final Clean,,2026-05-18,2026-05-20,NOT_STARTED,0,Punch List`
      ),
    });

    expect(result.success).toBe(false);
    if (result.success) throw new Error("expected the cyclic import to be rejected");
    expect(result.error).toContain("circular");

    expect(await projectDependencies()).toEqual(edgesBefore);
    const rolledBack = await prisma.task.findUniqueOrThrow({ where: { id: alpha.id } });
    expect(day(rolledBack.startDate)).toBe("2026-05-01");
  });

  it("denies a TRADE member", async () => {
    const before = await projectTasks();
    session.userId = fixture.trade.user.id;

    try {
      const result = await importScheduleCsv({
        projectId: fixture.project.id,
        csvText: csv(`Trade Attempt,,2026-06-01,2026-06-03,NOT_STARTED,0,`),
      });
      expect(result.success).toBe(false);
      if (result.success) throw new Error("expected the TRADE import to be denied");
      expect(result.error).toMatch(/Project Manager, Scheduler, or Superintendent/);
    } finally {
      session.userId = fixture.pm.user.id;
    }

    const after = await projectTasks();
    expect(after.map((task) => task.id)).toEqual(before.map((task) => task.id));
  });
});
