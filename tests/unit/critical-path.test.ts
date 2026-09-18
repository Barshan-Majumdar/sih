import { describe, it, expect } from "vitest";
import { computeCriticalPath, wouldCreateCycle } from "@/lib/critical-path";

function day(n: number): Date {
  return new Date(2026, 0, 1 + n);
}

describe("computeCriticalPath", () => {
  it("returns empty set for no tasks", () => {
    expect(computeCriticalPath([], [])).toEqual(new Set());
  });

  it("with independent (non-dependent) tasks, only the longest determines project length and is critical", () => {
    const tasks = [
      { id: "a", startDate: day(0), endDate: day(2) }, // 2 days — has 3 days of slack
      { id: "b", startDate: day(0), endDate: day(5) }, // 5 days — sets the overall length
    ];
    const critical = computeCriticalPath(tasks, []);
    expect(critical.has("b")).toBe(true);
    expect(critical.has("a")).toBe(false);
  });

  it("marks a single standalone task critical (it alone determines project length)", () => {
    const tasks = [{ id: "solo", startDate: day(0), endDate: day(3) }];
    const critical = computeCriticalPath(tasks, []);
    expect(critical.has("solo")).toBe(true);
  });

  it("identifies the longest chain as critical and leaves slack tasks off it", () => {
    // a(2d) -> c(3d) is the long chain (5d); b(1d) -> c is short (1d), giving b slack.
    const tasks = [
      { id: "a", startDate: day(0), endDate: day(2) },
      { id: "b", startDate: day(0), endDate: day(1) },
      { id: "c", startDate: day(2), endDate: day(5) },
    ];
    const dependencies = [
      { predecessorId: "a", successorId: "c" },
      { predecessorId: "b", successorId: "c" },
    ];
    const critical = computeCriticalPath(tasks, dependencies);
    expect(critical.has("a")).toBe(true);
    expect(critical.has("c")).toBe(true);
    expect(critical.has("b")).toBe(false); // has float — not on the critical path
  });

  it("returns an empty set instead of throwing if the graph has a cycle", () => {
    const tasks = [
      { id: "a", startDate: day(0), endDate: day(1) },
      { id: "b", startDate: day(1), endDate: day(2) },
    ];
    const dependencies = [
      { predecessorId: "a", successorId: "b" },
      { predecessorId: "b", successorId: "a" }, // cycle
    ];
    expect(computeCriticalPath(tasks, dependencies)).toEqual(new Set());
  });
});

describe("wouldCreateCycle", () => {
  it("rejects a task depending on itself", () => {
    expect(wouldCreateCycle([], "a", "a")).toBe(true);
  });

  it("allows a simple new edge with no existing relationship", () => {
    expect(wouldCreateCycle([], "a", "b")).toBe(false);
  });

  it("detects a cycle that would form via existing transitive edges", () => {
    // Existing: a -> b -> c. Proposed: c -> a would close the loop.
    const existing = [
      { predecessorId: "a", successorId: "b" },
      { predecessorId: "b", successorId: "c" },
    ];
    expect(wouldCreateCycle(existing, "c", "a")).toBe(true);
  });

  it("does not flag independent branches as cyclic", () => {
    const existing = [
      { predecessorId: "a", successorId: "b" },
      { predecessorId: "x", successorId: "y" },
    ];
    expect(wouldCreateCycle(existing, "b", "y")).toBe(false);
  });
});
