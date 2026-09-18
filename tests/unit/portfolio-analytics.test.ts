import { describe, it, expect } from "vitest";
import { computeProjectVariance, computeHealthScore } from "@/lib/portfolio-analytics";

describe("computeProjectVariance", () => {
  it("averages day-variance across snapshots that still have a matching current task", () => {
    const snapshots = [
      { taskId: "t1", endDate: new Date("2026-01-10") },
      { taskId: "t2", endDate: new Date("2026-01-15") },
      { taskId: "t3", endDate: new Date("2026-01-20") }, // deleted task — excluded below
    ];
    const current = new Map([
      ["t1", new Date("2026-01-13")], // +3 days
      ["t2", new Date("2026-01-15")], // 0 days
    ]);
    expect(computeProjectVariance(snapshots, current)).toBe(2); // (3 + 0) / 2 rounded
  });

  it("returns null when there are no snapshots at all", () => {
    expect(computeProjectVariance([], new Map())).toBeNull();
  });

  it("returns null when every snapshotted task has since been deleted", () => {
    expect(computeProjectVariance([{ taskId: "gone", endDate: new Date() }], new Map())).toBeNull();
  });
});

describe("computeHealthScore", () => {
  it("scores 100 when every available input is perfect", () => {
    expect(computeHealthScore({ ppc: 100, prr: 100, varianceDays: 0, openRoadblocks: 0 })).toBe(100);
  });

  it("renormalizes weights when PPC/PRR data is missing rather than penalizing new projects", () => {
    const score = computeHealthScore({ ppc: null, prr: null, varianceDays: null, openRoadblocks: 0 });
    // Only the roadblock component (0 roadblocks -> 100) is available.
    expect(score).toBe(100);
  });

  it("scores a struggling project (behind schedule, roadblocks, poor PPC/PRR) below 60", () => {
    const score = computeHealthScore({ ppc: 40, prr: 30, varianceDays: 10, openRoadblocks: 3 });
    expect(score).not.toBeNull();
    expect(score!).toBeLessThan(60);
  });

  it("never returns null when at least the roadblock component is available", () => {
    expect(computeHealthScore({ ppc: null, prr: null, varianceDays: null, openRoadblocks: 5 })).not.toBeNull();
  });
});
