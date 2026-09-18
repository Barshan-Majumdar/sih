import { describe, it, expect } from "vitest";
import {
  mapProcoreRfiStatus,
  mapProcoreSubmittalStatus,
  procoreRfiQuestion,
  procoreSubmittalTitle,
} from "@/lib/procore-sync";

describe("mapProcoreRfiStatus", () => {
  it("maps closed statuses", () => {
    expect(mapProcoreRfiStatus("Closed", false)).toBe("CLOSED");
    expect(mapProcoreRfiStatus("void", false)).toBe("CLOSED");
  });

  it("maps answered statuses", () => {
    expect(mapProcoreRfiStatus("Open", true)).toBe("ANSWERED");
    expect(mapProcoreRfiStatus("answered", false)).toBe("ANSWERED");
  });

  it("defaults to OPEN", () => {
    expect(mapProcoreRfiStatus("Open", false)).toBe("OPEN");
    expect(mapProcoreRfiStatus(null, false)).toBe("OPEN");
  });
});

describe("mapProcoreSubmittalStatus", () => {
  it("maps approval states", () => {
    expect(mapProcoreSubmittalStatus("Approved")).toBe("APPROVED");
    expect(mapProcoreSubmittalStatus({ name: "Rejected" })).toBe("REJECTED");
    expect(mapProcoreSubmittalStatus("Revise and Resubmit")).toBe("REVISE_RESUBMIT");
  });

  it("defaults to PENDING", () => {
    expect(mapProcoreSubmittalStatus("Open")).toBe("PENDING");
    expect(mapProcoreSubmittalStatus(null)).toBe("PENDING");
  });
});

describe("procore field helpers", () => {
  it("builds RFI question from subject + question", () => {
    expect(procoreRfiQuestion({ id: 1, subject: "Door spec", question: "What hardware?" })).toBe(
      "Door spec: What hardware?"
    );
    expect(procoreRfiQuestion({ id: 2, subject: "Only subject" })).toBe("Only subject");
    expect(procoreRfiQuestion({ id: 3 })).toBe("Procore RFI #3");
  });

  it("builds submittal title fallback", () => {
    expect(procoreSubmittalTitle({ id: 9, title: "Storefront" })).toBe("Storefront");
    expect(procoreSubmittalTitle({ id: 9, number: "A-101" })).toBe("Submittal A-101");
    expect(procoreSubmittalTitle({ id: 9 })).toBe("Procore Submittal #9");
  });
});
