import { describe, it, expect } from "vitest";
import { computePpcTrend, computePrrByMember, computeSCurve } from "@/lib/analytics";

describe("computePpcTrend", () => {
  const w1 = new Date("2026-01-05");
  const w2 = new Date("2026-01-12");

  it("groups commitments by week and computes percent completed", () => {
    const trend = computePpcTrend([
      { weekStartDate: w1, status: "COMPLETED" },
      { weekStartDate: w1, status: "NOT_COMPLETED" },
      { weekStartDate: w2, status: "COMPLETED" },
      { weekStartDate: w2, status: "COMPLETED" },
    ]);
    expect(trend).toHaveLength(2);
    expect(trend[0]).toMatchObject({ ppc: 50, total: 2, completed: 1 });
    expect(trend[1]).toMatchObject({ ppc: 100, total: 2, completed: 2 });
  });

  it("sorts weeks ascending regardless of input order", () => {
    const trend = computePpcTrend([
      { weekStartDate: w2, status: "COMPLETED" },
      { weekStartDate: w1, status: "COMPLETED" },
    ]);
    expect(trend[0].weekStart.getTime()).toBe(w1.getTime());
    expect(trend[1].weekStart.getTime()).toBe(w2.getTime());
  });

  it("returns an empty array for no commitments", () => {
    expect(computePpcTrend([])).toEqual([]);
  });

  it("excludes soft-removed commitments from PPC", () => {
    const trend = computePpcTrend([
      { weekStartDate: w1, status: "COMPLETED" },
      { weekStartDate: w1, status: "NOT_COMPLETED", removedAt: new Date("2026-01-01") },
    ]);
    expect(trend).toEqual([{ weekStart: w1, ppc: 100, total: 1, completed: 1 }]);
  });
});

describe("computePrrByMember", () => {
  it("computes per-member completion rate independently", () => {
    const prr = computePrrByMember([
      { committedById: "m1", committedByName: "Tom", status: "COMPLETED" },
      { committedById: "m1", committedByName: "Tom", status: "COMPLETED" },
      { committedById: "m1", committedByName: "Tom", status: "NOT_COMPLETED" },
      { committedById: "m2", committedByName: "Sara", status: "NOT_COMPLETED" },
    ]);
    const tom = prr.find((p) => p.memberId === "m1")!;
    const sara = prr.find((p) => p.memberId === "m2")!;
    expect(tom.prr).toBe(67);
    expect(sara.prr).toBe(0);
  });

  it("sorts by total commitments descending", () => {
    const prr = computePrrByMember([
      { committedById: "low", committedByName: "Low", status: "COMPLETED" },
      { committedById: "high", committedByName: "High", status: "COMPLETED" },
      { committedById: "high", committedByName: "High", status: "COMPLETED" },
    ]);
    expect(prr[0].memberId).toBe("high");
  });

  it("excludes soft-removed commitments from PRR", () => {
    const prr = computePrrByMember([
      { committedById: "m1", committedByName: "Tom", status: "COMPLETED" },
      {
        committedById: "m1",
        committedByName: "Tom",
        status: "NOT_COMPLETED",
        removedAt: new Date("2026-01-01"),
      },
    ]);
    expect(prr[0]).toMatchObject({ total: 1, completed: 1, prr: 100 });
  });
});

describe("computeSCurve", () => {
  const rangeStart = new Date("2026-01-01");
  const rangeEnd = new Date("2026-01-22");
  const tasks = [
    { endDate: new Date("2026-01-05"), status: "DONE" as const, updatedAt: new Date("2026-01-04") },
    { endDate: new Date("2026-01-10"), status: "NOT_STARTED" as const, updatedAt: new Date("2026-01-01") },
    { endDate: new Date("2026-01-15"), status: "DONE" as const, updatedAt: new Date("2026-01-16") },
  ];

  it("planned cumulative reaches the full task count by the end of the range", () => {
    const { planned } = computeSCurve(tasks, rangeStart, rangeEnd);
    expect(planned[planned.length - 1].cumulative).toBe(3);
  });

  it("actual cumulative is non-decreasing and never exceeds planned's final count", () => {
    const { actual, planned } = computeSCurve(tasks, rangeStart, rangeEnd);
    const values = actual.map((p) => p.cumulative);
    const nonDecreasing = values.every((v, i) => i === 0 || v >= values[i - 1]);
    expect(nonDecreasing).toBe(true);
    expect(Math.max(...values, 0)).toBeLessThanOrEqual(planned[planned.length - 1].cumulative);
  });
});
