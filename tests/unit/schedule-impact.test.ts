import { describe, expect, it } from "vitest";
import {
  analyzeScheduleImpact,
  computeScheduleCriticalTasks,
  projectFinish,
  shiftTaskByDays,
  simulateDownstreamReflow,
} from "@/lib/schedule-impact";

const day = (value: string) => new Date(`${value}T12:00:00.000Z`);

describe("analyzeScheduleImpact", () => {
  const tasks = [
    { id: "a", name: "Structure", startDate: day("2026-07-01"), endDate: day("2026-07-05") },
    { id: "b", name: "Rough-in", startDate: day("2026-07-06"), endDate: day("2026-07-10") },
  ];

  it("surfaces finish-to-start conflicts and downstream review", () => {
    const shifted = [shiftTaskByDays(tasks[0], 3), tasks[1]];
    const warnings = analyzeScheduleImpact({
      projectStart: day("2026-07-01"),
      projectEnd: day("2026-07-31"),
      beforeTasks: tasks,
      afterTasks: shifted,
      beforeEdges: [{ predecessorId: "a", successorId: "b" }],
      afterEdges: [{ predecessorId: "a", successorId: "b" }],
      changedTaskIds: ["a"],
    });

    expect(warnings.some((warning) => warning.includes("starts before its predecessor"))).toBe(true);
    expect(warnings.some((warning) => warning.includes("Review downstream dates"))).toBe(true);
  });

  it("warns when shifted work crosses project boundaries", () => {
    const warnings = analyzeScheduleImpact({
      projectStart: day("2026-07-01"),
      projectEnd: day("2026-07-08"),
      beforeTasks: tasks,
      afterTasks: [tasks[0], shiftTaskByDays(tasks[1], 3)],
      beforeEdges: [],
      afterEdges: [],
      changedTaskIds: ["b"],
    });

    expect(warnings.some((warning) => warning.includes("outside the current project dates"))).toBe(true);
  });
});

describe("simulateDownstreamReflow", () => {
  it("moves a dependency chain only as much as finish-to-start logic requires", () => {
    const tasks = [
      { id: "a", name: "Inspection", startDate: day("2026-07-01"), endDate: day("2026-07-05") },
      { id: "b", name: "Drywall", startDate: day("2026-07-05"), endDate: day("2026-07-08") },
      { id: "c", name: "Paint", startDate: day("2026-07-08"), endDate: day("2026-07-10") },
    ];
    const edges = [
      { predecessorId: "a", successorId: "b" },
      { predecessorId: "b", successorId: "c" },
    ];

    const result = simulateDownstreamReflow({ tasks, edges, anchorTaskId: "a", shiftDays: 3 });

    expect(result.changedTaskIds).toEqual(["a", "b", "c"]);
    expect(result.downstreamTaskIds).toEqual(["b", "c"]);
    expect(result.afterTasks.map((task) => task.startDate.toISOString().slice(0, 10))).toEqual([
      "2026-07-04",
      "2026-07-08",
      "2026-07-11",
    ]);
    expect(projectFinish(result.afterTasks)?.toISOString().slice(0, 10)).toBe("2026-07-13");
  });

  it("absorbs a delay inside available float without moving downstream work", () => {
    const tasks = [
      { id: "a", name: "Inspection", startDate: day("2026-07-01"), endDate: day("2026-07-05") },
      { id: "b", name: "Drywall", startDate: day("2026-07-10"), endDate: day("2026-07-12") },
    ];
    const result = simulateDownstreamReflow({
      tasks,
      edges: [{ predecessorId: "a", successorId: "b" }],
      anchorTaskId: "a",
      shiftDays: 3,
    });

    expect(result.changedTaskIds).toEqual(["a"]);
    expect(result.downstreamTaskIds).toEqual([]);
    expect(projectFinish(result.afterTasks)?.toISOString().slice(0, 10)).toBe("2026-07-12");
  });

  it("reports completed downstream work that would have to move", () => {
    const tasks = [
      { id: "a", name: "Inspection", startDate: day("2026-07-01"), endDate: day("2026-07-05") },
      { id: "b", name: "Completed drywall", startDate: day("2026-07-05"), endDate: day("2026-07-08") },
    ];
    const result = simulateDownstreamReflow({
      tasks,
      edges: [{ predecessorId: "a", successorId: "b" }],
      anchorTaskId: "a",
      shiftDays: 2,
      lockedTaskIds: ["b"],
    });

    expect(result.blockedTaskIds).toEqual(["b"]);
  });

  it("limits an earlier move to the anchor task's predecessor finish", () => {
    const tasks = [
      { id: "a", name: "Rough-in", startDate: day("2026-07-01"), endDate: day("2026-07-05") },
      { id: "b", name: "Inspection", startDate: day("2026-07-08"), endDate: day("2026-07-10") },
    ];
    const result = simulateDownstreamReflow({
      tasks,
      edges: [{ predecessorId: "a", successorId: "b" }],
      anchorTaskId: "b",
      shiftDays: -5,
    });

    expect(result.anchorAppliedDays).toBe(-3);
    expect(result.afterTasks[1].startDate.toISOString().slice(0, 10)).toBe("2026-07-05");
  });

  it("detects when the delayed chain becomes the date-driven critical work", () => {
    const tasks = [
      { id: "a", name: "Inspection", startDate: day("2026-07-01"), endDate: day("2026-07-05") },
      { id: "b", name: "Drywall", startDate: day("2026-07-05"), endDate: day("2026-07-10") },
      { id: "c", name: "Independent closeout", startDate: day("2026-07-01"), endDate: day("2026-07-12") },
    ];
    const edges = [{ predecessorId: "a", successorId: "b" }];
    const beforeCritical = computeScheduleCriticalTasks(tasks, edges);
    const after = simulateDownstreamReflow({ tasks, edges, anchorTaskId: "a", shiftDays: 3 });
    const afterCritical = computeScheduleCriticalTasks(after.afterTasks, edges);

    expect([...beforeCritical]).toEqual(["c"]);
    expect([...afterCritical]).toEqual(["a", "b"]);
  });
});
