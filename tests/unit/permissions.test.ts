import { describe, it, expect } from "vitest";
import {
  PROJECT_CAPABILITY_ROLES,
  canManageSchedule,
  canResolveRoadblocks,
  hasProjectCapability,
  isProjectManager,
} from "@/lib/permissions";
import type { ProjectRole } from "@prisma/client";

const ALL_ROLES: ProjectRole[] = ["PROJECT_MANAGER", "SCHEDULER", "SUPERINTENDENT", "TRADE"];

describe("project capability matrix", () => {
  it("keeps the audited role matrix explicit and internally consistent", () => {
    expect(PROJECT_CAPABILITY_ROLES).toEqual({
      VIEW_PROJECT: ALL_ROLES,
      MANAGE_PROJECT: ["PROJECT_MANAGER"],
      EDIT_SCHEDULE: ["PROJECT_MANAGER", "SCHEDULER", "SUPERINTENDENT"],
      RESOLVE_ROADBLOCKS: ["PROJECT_MANAGER", "SUPERINTENDENT"],
      COMMIT_ANY_TASK: ["PROJECT_MANAGER", "SUPERINTENDENT"],
      REVIEW_SCHEDULE_IMPACTS: ["PROJECT_MANAGER", "SUPERINTENDENT"],
      SUBMIT_FIELD_ITEMS: ALL_ROLES,
      UPLOAD_PROJECT_FILES: ALL_ROLES,
    });

    for (const [capability, allowedRoles] of Object.entries(PROJECT_CAPABILITY_ROLES)) {
      for (const role of ALL_ROLES) {
        expect(hasProjectCapability(role, capability as keyof typeof PROJECT_CAPABILITY_ROLES)).toBe(
          allowedRoles.includes(role)
        );
      }
    }
  });
});

describe("isProjectManager", () => {
  it("is true only for PROJECT_MANAGER", () => {
    for (const role of ALL_ROLES) {
      expect(isProjectManager(role)).toBe(role === "PROJECT_MANAGER");
    }
  });
});

describe("canManageSchedule", () => {
  it("is true for GC-side roles (PM, Scheduler, Superintendent), false for Trade", () => {
    expect(canManageSchedule("PROJECT_MANAGER")).toBe(true);
    expect(canManageSchedule("SCHEDULER")).toBe(true);
    expect(canManageSchedule("SUPERINTENDENT")).toBe(true);
    expect(canManageSchedule("TRADE")).toBe(false);
  });
});

describe("canResolveRoadblocks", () => {
  it("is true only for PM and Superintendent — matches the approved capability matrix", () => {
    expect(canResolveRoadblocks("PROJECT_MANAGER")).toBe(true);
    expect(canResolveRoadblocks("SUPERINTENDENT")).toBe(true);
    expect(canResolveRoadblocks("SCHEDULER")).toBe(false);
    expect(canResolveRoadblocks("TRADE")).toBe(false);
  });
});
