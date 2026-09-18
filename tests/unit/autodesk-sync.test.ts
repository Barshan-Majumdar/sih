import { describe, it, expect } from "vitest";
import { autodeskDrawingTitle, autodeskDisciplineFromName } from "@/lib/autodesk-sync";

describe("autodeskDrawingTitle", () => {
  it("strips .pdf extension", () => {
    expect(autodeskDrawingTitle("A-101 Floor Plan.pdf")).toBe("A-101 Floor Plan");
  });

  it("handles empty names", () => {
    expect(autodeskDrawingTitle("")).toBe("ACC Drawing");
  });
});

describe("autodeskDisciplineFromName", () => {
  it("extracts discipline prefix when present", () => {
    expect(autodeskDisciplineFromName("A-101 Floor Plan.pdf")).toBe("A");
    expect(autodeskDisciplineFromName("M-200 HVAC.pdf")).toBe("M");
  });

  it("returns null when no prefix", () => {
    expect(autodeskDisciplineFromName("floor-plan.pdf")).toBeNull();
  });
});
