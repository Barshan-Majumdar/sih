import { describe, expect, it } from "vitest";
import { getWeekStart } from "@/lib/utils";

describe("getWeekStart", () => {
  it.each([
    "2026-07-20T00:00:00.000Z",
    "2026-07-22T18:30:00.000Z",
    "2026-07-26T23:59:59.000Z",
  ])("normalizes %s to the same Monday at noon UTC", (value) => {
    expect(getWeekStart(new Date(value)).toISOString()).toBe("2026-07-20T12:00:00.000Z");
  });

  it("moves Sunday back to the preceding Monday", () => {
    expect(getWeekStart(new Date("2026-07-19T12:00:00.000Z")).toISOString()).toBe(
      "2026-07-13T12:00:00.000Z"
    );
  });
});
