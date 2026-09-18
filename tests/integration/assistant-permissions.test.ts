import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { confirmAssistantAction, createRoadblockActionProposal } from "@/lib/assistant-actions";
import { createAssistantTools, type AssistantTools } from "@/lib/assistant-tools";
import { PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

type ToolName = keyof AssistantTools;

const toolOptions = { toolCallId: "permission-matrix", messages: [], context: {} };

async function executeTool(tools: AssistantTools, name: ToolName, input: Record<string, unknown>) {
  const execute = tools[name].execute as unknown as (
    value: Record<string, unknown>,
    options: typeof toolOptions
  ) => Promise<unknown>;
  return execute(input, toolOptions);
}

describe("Agent permission matrix", () => {
  let fixture: Fixture;
  let outsiderUserId: string;
  let staleUserId: string;
  let revokedUserId: string;
  let outsiderConversationId: string;
  let staleConversationId: string;
  let revokedConversationId: string;

  beforeAll(async () => {
    fixture = await createFixture();

    const outsider = await prisma.user.create({
      data: {
        name: "Organization-only Agent user",
        email: `agent-org-only-${fixture.organization.id}@test.local`,
        emailVerified: true,
      },
    });
    outsiderUserId = outsider.id;
    await prisma.member.create({
      data: { organizationId: fixture.organization.id, userId: outsider.id },
    });
    outsiderConversationId = (
      await prisma.assistantConversation.create({
        data: {
          organizationId: fixture.organization.id,
          createdById: outsider.id,
          title: "Organization-only permission test",
        },
      })
    ).id;

    const stale = await prisma.user.create({
      data: {
        name: "Removed organization Agent user",
        email: `agent-removed-org-${fixture.organization.id}@test.local`,
        emailVerified: true,
      },
    });
    staleUserId = stale.id;
    await prisma.projectMember.create({
      data: {
        projectId: fixture.project.id,
        userId: stale.id,
        role: "PROJECT_MANAGER",
      },
    });
    staleConversationId = (
      await prisma.assistantConversation.create({
        data: {
          organizationId: fixture.organization.id,
          projectId: fixture.project.id,
          createdById: stale.id,
          title: "Removed organization permission test",
        },
      })
    ).id;

    const revoked = await prisma.user.create({
      data: {
        name: "Revoked Agent user",
        email: `agent-revoked-${fixture.organization.id}@test.local`,
        emailVerified: true,
      },
    });
    revokedUserId = revoked.id;
    await prisma.member.create({
      data: { organizationId: fixture.organization.id, userId: revoked.id },
    });
    await prisma.projectMember.create({
      data: {
        projectId: fixture.project.id,
        userId: revoked.id,
        role: "TRADE",
      },
    });
    revokedConversationId = (
      await prisma.assistantConversation.create({
        data: {
          organizationId: fixture.organization.id,
          projectId: fixture.project.id,
          createdById: revoked.id,
          title: "Revoked confirmation permission test",
        },
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
    await prisma.user.deleteMany({
      where: { id: { in: [outsiderUserId, staleUserId, revokedUserId] } },
    });
  });

  function toolsFor(userId: string, conversationId: string, focusProjectId = fixture.project.id) {
    return createAssistantTools({
      organizationId: fixture.organization.id,
      userId,
      conversationId,
      focusProjectId,
    });
  }

  it("blocks every Agent tool after organization access is removed", async () => {
    const tools = toolsFor(staleUserId, staleConversationId);
    const cases: Array<[ToolName, Record<string, unknown>]> = [
      ["searchProjectDocuments", { query: "waterproofing" }],
      ["searchProjectTasks", { query: "framing" }],
      ["getProjectMembers", {}],
      ["proposeRoadblockChange", { taskName: "Framing", note: "Blocked" }],
      ["proposeRfiChange", { operation: "CREATE", question: "Which detail applies?" }],
      ["proposeSubmittalChange", { operation: "CREATE", title: "Product data" }],
      [
        "proposeTaskChange",
        {
          operation: "CREATE",
          taskName: "Unauthorized task",
          startDate: "2026-08-01",
          endDate: "2026-08-02",
        },
      ],
      ["proposeTaskProgressChange", { taskName: "Framing", progress: 50 }],
      [
        "proposeWeeklyCommitmentChange",
        { operation: "CREATE", taskName: "Framing", weekStartDate: "2026-08-03" },
      ],
      [
        "proposeScheduleChange",
        { operation: "SHIFT_TASKS", taskNames: ["Framing"], scope: "NAMED_TASKS", shiftDays: 1 },
      ],
      [
        "proposeScheduleImpactChange",
        { operation: "CREATE", description: "Inspection delay" },
      ],
      ["proposeBaselineChange", { operation: "CREATE", name: "Unauthorized baseline" }],
      ["getPortfolioHealth", {}],
      ["getProjectOverview", {}],
      ["getScheduleRisks", {}],
      ["getOpenItems", { category: "roadblocks" }],
    ];

    for (const [name, input] of cases) {
      await expect(executeTool(tools, name, input), name).rejects.toBeInstanceOf(PermissionError);
    }
  });

  it("allows organization members to read only projects they belong to", async () => {
    const portfolioTools = createAssistantTools({
      organizationId: fixture.organization.id,
      userId: outsiderUserId,
      conversationId: outsiderConversationId,
    });
    await expect(executeTool(portfolioTools, "getPortfolioHealth", {})).resolves.toMatchObject({
      kind: "portfolio-health",
      projects: [],
    });
    await expect(
      executeTool(toolsFor(outsiderUserId, outsiderConversationId), "getProjectOverview", {})
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("allows a project member to use every read-only Agent tool", async () => {
    const conversation = await prisma.assistantConversation.create({
      data: {
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        createdById: fixture.trade.user.id,
        title: "Authorized read matrix",
      },
    });
    const tools = toolsFor(fixture.trade.user.id, conversation.id);
    const cases: Array<[ToolName, Record<string, unknown>]> = [
      ["searchProjectDocuments", { query: "schedule" }],
      ["searchProjectTasks", {}],
      ["getProjectMembers", {}],
      ["getPortfolioHealth", {}],
      ["getProjectOverview", {}],
      ["getScheduleRisks", {}],
      ["getOpenItems", { category: "rfis" }],
    ];

    for (const [name, input] of cases) {
      await expect(executeTool(tools, name, input), name).resolves.toBeTruthy();
    }
  });

  it("enforces role and record ownership for proposal tools", async () => {
    const tradeConversation = await prisma.assistantConversation.create({
      data: {
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        createdById: fixture.trade.user.id,
        title: "Trade permission matrix",
      },
    });
    const schedulerConversation = await prisma.assistantConversation.create({
      data: {
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        createdById: fixture.scheduler.user.id,
        title: "Scheduler permission matrix",
      },
    });
    const task = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Permission matrix framing",
        startDate: new Date("2026-08-10T12:00:00.000Z"),
        endDate: new Date("2026-08-12T12:00:00.000Z"),
      },
    });
    const roadblock = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Permission matrix roadblock",
        startDate: new Date("2026-08-13T12:00:00.000Z"),
        endDate: new Date("2026-08-14T12:00:00.000Z"),
        isRoadblock: true,
        roadblockStatus: "OPEN",
        roadblockNote: "Existing blocker",
      },
    });
    const rfi = await prisma.rFI.create({
      data: {
        projectId: fixture.project.id,
        question: "Permission matrix RFI",
        raisedById: fixture.trade.member.id,
      },
    });
    const submittal = await prisma.submittal.create({
      data: {
        projectId: fixture.project.id,
        title: "Permission matrix submittal",
        submittedById: fixture.trade.member.id,
      },
    });
    const impact = await prisma.scheduleImpactRequest.create({
      data: {
        projectId: fixture.project.id,
        description: "Permission matrix impact",
        submittedById: fixture.trade.member.id,
      },
    });
    const tradeTools = toolsFor(fixture.trade.user.id, tradeConversation.id);
    const schedulerTools = toolsFor(fixture.scheduler.user.id, schedulerConversation.id);

    const denied: Array<[AssistantTools, ToolName, Record<string, unknown>]> = [
      [
        tradeTools,
        "proposeTaskChange",
        {
          operation: "CREATE",
          taskName: "Trade-created schedule task",
          startDate: "2026-08-20",
          endDate: "2026-08-21",
        },
      ],
      [
        tradeTools,
        "proposeTaskProgressChange",
        { taskName: task.name, progress: 25 },
      ],
      [
        tradeTools,
        "proposeScheduleChange",
        { operation: "SHIFT_TASKS", taskNames: [task.name], scope: "NAMED_TASKS", shiftDays: 1 },
      ],
      [tradeTools, "proposeBaselineChange", { operation: "CREATE", name: "Trade baseline" }],
      [tradeTools, "proposeRoadblockChange", { taskName: roadblock.name, note: "Changed blocker" }],
      [
        tradeTools,
        "proposeRfiChange",
        { operation: "ANSWER", question: rfi.question, answer: "Unauthorized answer" },
      ],
      [
        tradeTools,
        "proposeSubmittalChange",
        { operation: "UPDATE_STATUS", title: submittal.title, status: "APPROVED" },
      ],
      [
        schedulerTools,
        "proposeWeeklyCommitmentChange",
        { operation: "CREATE", taskName: task.name, weekStartDate: "2026-08-10" },
      ],
      [
        schedulerTools,
        "proposeScheduleImpactChange",
        { operation: "REVIEW", description: impact.description, status: "APPROVED" },
      ],
    ];

    for (const [tools, name, input] of denied) {
      let denial: unknown;
      try {
        await executeTool(tools, name, input);
      } catch (error) {
        denial = error;
      }
      const deniedByPermission =
        denial instanceof PermissionError ||
        (typeof denial === "object" && denial !== null && "status" in denial && denial.status === 403);
      expect(deniedByPermission, `${name} should reject this role`).toBe(true);
    }
  });

  it("rejects a roadblock proposal whose conversation belongs to another project", async () => {
    const otherProject = await prisma.project.create({
      data: {
        organizationId: fixture.organization.id,
        name: "Permission matrix second project",
        startDate: new Date("2026-08-01T12:00:00.000Z"),
        endDate: new Date("2026-09-01T12:00:00.000Z"),
      },
    });
    await prisma.projectMember.create({
      data: {
        projectId: otherProject.id,
        userId: fixture.pm.user.id,
        role: "PROJECT_MANAGER",
      },
    });
    const otherTask = await prisma.task.create({
      data: {
        projectId: otherProject.id,
        name: "Cross-project roadblock task",
        startDate: new Date("2026-08-05T12:00:00.000Z"),
        endDate: new Date("2026-08-06T12:00:00.000Z"),
      },
    });
    const conversation = await prisma.assistantConversation.create({
      data: {
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        createdById: fixture.pm.user.id,
        title: "Cross-project roadblock test",
      },
    });

    await expect(
      createRoadblockActionProposal(
        {
          conversationId: conversation.id,
          taskId: otherTask.id,
          note: "This must not cross project boundaries.",
        },
        { organizationId: fixture.organization.id, userId: fixture.pm.user.id }
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rechecks organization membership when a pending proposal is confirmed", async () => {
    const task = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Revoked confirmation task",
        startDate: new Date("2026-08-22T12:00:00.000Z"),
        endDate: new Date("2026-08-23T12:00:00.000Z"),
      },
    });
    const output = await executeTool(
      toolsFor(revokedUserId, revokedConversationId),
      "proposeRoadblockChange",
      { taskName: task.name, note: "This proposal must not survive revoked access." }
    );
    if (!output || typeof output !== "object" || !("proposal" in output)) {
      throw new Error("Expected a pending roadblock proposal");
    }
    const proposal = output.proposal as { id: string };

    await prisma.member.delete({
      where: {
        organizationId_userId: {
          organizationId: fixture.organization.id,
          userId: revokedUserId,
        },
      },
    });

    await expect(
      confirmAssistantAction(proposal.id, {
        organizationId: fixture.organization.id,
        userId: revokedUserId,
      })
    ).rejects.toBeInstanceOf(PermissionError);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      isRoadblock: false,
      roadblockStatus: null,
    });
    expect(
      await prisma.assistantActionProposal.findUniqueOrThrow({ where: { id: proposal.id } })
    ).toMatchObject({ status: "PENDING" });
  });
});
