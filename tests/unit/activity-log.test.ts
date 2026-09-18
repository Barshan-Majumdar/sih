import { describe, expect, it } from "vitest";
import { activityChanges } from "@/lib/activity-log";

describe("activityChanges", () => {
  it("normalizes dates and records only changed fields", () => {
    expect(
      activityChanges(
        {
          name: "Rough plumbing",
          status: "NOT_STARTED",
          startDate: new Date("2026-07-20T00:00:00.000Z"),
          ownerId: null,
        },
        {
          name: "Rough plumbing",
          status: "IN_PROGRESS",
          startDate: new Date("2026-07-21T00:00:00.000Z"),
          ownerId: "member-1",
        },
        ["name", "status", "startDate", "ownerId"]
      )
    ).toEqual({
      status: { before: "NOT_STARTED", after: "IN_PROGRESS" },
      startDate: {
        before: "2026-07-20T00:00:00.000Z",
        after: "2026-07-21T00:00:00.000Z",
      },
      ownerId: { before: null, after: "member-1" },
    });
  });

  it("returns undefined when no audited field changed", () => {
    expect(activityChanges({ status: "DONE" }, { status: "DONE" }, ["status"])).toBeUndefined();
  });
});
