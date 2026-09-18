import { describe, expect, it } from "vitest";
import {
  buildProjectSetupSteps,
  completedProjectSetupSteps,
} from "@/lib/project-onboarding";

describe("project onboarding", () => {
  it("starts with only the project creation step complete", () => {
    const steps = buildProjectSetupSteps("project-1", {
      taskCount: 0,
      memberCount: 1,
      fileCount: 0,
      agentQuestionCount: 0,
    });

    expect(completedProjectSetupSteps(steps)).toBe(1);
    expect(steps.map((step) => [step.id, step.complete])).toEqual([
      ["project-created", true],
      ["first-task", false],
      ["first-teammate", false],
      ["first-file", false],
      ["first-agent-question", false],
    ]);
    expect(steps[1]?.href).toBe("/projects/project-1");
    expect(steps[2]?.href).toBe("/projects/project-1/members");
    expect(steps[3]?.href).toBe("/projects/project-1/files");
  });

  it("derives completion entirely from project activity", () => {
    const steps = buildProjectSetupSteps("project-1", {
      taskCount: 3,
      memberCount: 2,
      fileCount: 1,
      agentQuestionCount: 4,
    });

    expect(completedProjectSetupSteps(steps)).toBe(5);
    expect(steps.every((step) => step.complete)).toBe(true);
  });
});
