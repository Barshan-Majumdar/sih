import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAssistantTools, type AssistantTools } from "@/lib/assistant-tools";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

const toolOptions = { toolCallId: "read-tool-contract", messages: [], context: {} };

async function executeTool(
  tools: AssistantTools,
  name: keyof AssistantTools,
  input: Record<string, unknown>
) {
  const execute = tools[name].execute as unknown as (
    value: Record<string, unknown>,
    options: typeof toolOptions
  ) => Promise<unknown>;
  return execute(input, toolOptions);
}

describe("Agent read tool result contracts", () => {
  let fixture: Fixture;
  let tools: AssistantTools;
  let exactTaskId: string;
  let riskTaskId: string;

  beforeAll(async () => {
    fixture = await createFixture();
    const conversation = await prisma.assistantConversation.create({
      data: {
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        createdById: fixture.pm.user.id,
        title: "Read tool contract test",
      },
    });
    const exactTask = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Level 2 framing",
        assignedToId: fixture.superintendent.member.id,
        startDate: new Date("2026-02-02T12:00:00.000Z"),
        endDate: new Date("2026-02-06T12:00:00.000Z"),
        status: "IN_PROGRESS",
        progress: 40,
      },
    });
    exactTaskId = exactTask.id;
    const riskTask = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Electrical inspection",
        assignedToId: fixture.trade.member.id,
        startDate: new Date("2026-02-09T12:00:00.000Z"),
        endDate: new Date("2026-02-10T12:00:00.000Z"),
        status: "DELAYED",
        progress: 25,
        isRoadblock: true,
        roadblockStatus: "OPEN",
        roadblockNote: "City inspection is pending.",
        roadblockType: "INSPECTION",
        roadblockOwnerId: fixture.superintendent.member.id,
        roadblockDueDate: new Date("2026-02-11T12:00:00.000Z"),
      },
    });
    riskTaskId = riskTask.id;

    await prisma.rFI.createMany({
      data: [
        {
          projectId: fixture.project.id,
          question: "What fire rating applies?",
          status: "OPEN",
          dueDate: new Date("2026-02-12T12:00:00.000Z"),
          raisedById: fixture.trade.member.id,
        },
        {
          projectId: fixture.project.id,
          question: "Closed coordination question",
          status: "CLOSED",
          raisedById: fixture.trade.member.id,
        },
      ],
    });
    await prisma.submittal.createMany({
      data: [
        {
          projectId: fixture.project.id,
          title: "Door hardware product data",
          status: "PENDING",
          dueDate: new Date("2026-02-13T12:00:00.000Z"),
          submittedById: fixture.trade.member.id,
        },
        {
          projectId: fixture.project.id,
          title: "Approved concrete mix",
          status: "APPROVED",
          submittedById: fixture.trade.member.id,
        },
      ],
    });
    await prisma.scheduleImpactRequest.createMany({
      data: [
        {
          projectId: fixture.project.id,
          taskId: riskTask.id,
          description: "Inspection shifted the electrical sequence",
          status: "PENDING",
          proposedNewEndDate: new Date("2026-02-15T12:00:00.000Z"),
          submittedById: fixture.trade.member.id,
        },
        {
          projectId: fixture.project.id,
          description: "Reviewed weather impact",
          status: "APPROVED",
          submittedById: fixture.trade.member.id,
          reviewedById: fixture.pm.member.id,
          reviewedAt: new Date("2026-02-01T12:00:00.000Z"),
        },
      ],
    });

    tools = createAssistantTools({
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
      conversationId: conversation.id,
      focusProjectId: fixture.project.id,
    });
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it("returns ranked task details and secure schedule sources", async () => {
    await expect(executeTool(tools, "searchProjectTasks", { query: "Level 2 framing" })).resolves.toMatchObject({
      kind: "task-search",
      match: "exact",
      tasks: [
        {
          name: "Level 2 framing",
          status: "In Progress",
          assignee: fixture.superintendent.user.name,
          href: `/projects/${fixture.project.id}/tasks/${exactTaskId}`,
        },
      ],
      sources: [{ href: `/projects/${fixture.project.id}/gantt` }],
    });
  });

  it("returns an unambiguous member match without exposing member IDs", async () => {
    const output = await executeTool(tools, "getProjectMembers", {
      query: fixture.trade.user.email,
    });
    expect(output).toMatchObject({
      kind: "project-members",
      match: "unique",
      members: [
        {
          name: fixture.trade.user.name,
          email: fixture.trade.user.email,
          role: "TRADE",
        },
      ],
    });
    expect(JSON.stringify(output)).not.toContain(fixture.trade.member.id);
  });

  it("returns accessible portfolio and project health contracts", async () => {
    await expect(executeTool(tools, "getPortfolioHealth", {})).resolves.toMatchObject({
      kind: "portfolio-health",
      projects: [
        {
          projectRef: "project-1",
          name: fixture.project.name,
          href: `/projects/${fixture.project.id}/dashboard`,
          openRoadblocks: 1,
        },
      ],
    });
    await expect(executeTool(tools, "getProjectOverview", {})).resolves.toMatchObject({
      kind: "project-overview",
      project: {
        name: fixture.project.name,
        openRoadblocks: 1,
      },
      sources: expect.arrayContaining([
        expect.objectContaining({ href: `/projects/${fixture.project.id}/dashboard` }),
        expect.objectContaining({ href: `/projects/${fixture.project.id}/gantt` }),
      ]),
    });
  });

  it("returns delayed and blocked schedule risks with ownership", async () => {
    await expect(executeTool(tools, "getScheduleRisks", {})).resolves.toMatchObject({
      kind: "schedule-risks",
      count: 1,
      risks: [
        {
          name: "Electrical inspection",
          status: "Delayed",
          roadblock: "City inspection is pending.",
          roadblockType: "Inspection",
          roadblockOwner: fixture.superintendent.user.name,
          href: `/projects/${fixture.project.id}/tasks/${riskTaskId}`,
        },
      ],
    });
  });

  it.each([
    ["roadblocks", "Electrical inspection"],
    ["rfis", "What fire rating applies?"],
    ["submittals", "Door hardware product data"],
    ["impacts", "Inspection shifted the electrical sequence"],
  ] as const)("returns only open %s records", async (category, title) => {
    const output = await executeTool(tools, "getOpenItems", { category });
    expect(output).toMatchObject({
      kind: "open-items",
      category,
      count: 1,
      items: [expect.objectContaining({ title })],
      sources: [{ href: `/projects/${fixture.project.id}/${category}` }],
    });
    if (category === "roadblocks") {
      expect(output).toMatchObject({
        items: [
          expect.objectContaining({
            href: `/projects/${fixture.project.id}/tasks/${riskTaskId}`,
          }),
        ],
      });
    }
  });
});
