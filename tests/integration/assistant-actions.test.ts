import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  cancelAssistantAction,
  confirmAssistantAction,
  createRoadblockActionProposal,
} from "@/lib/assistant-actions";
import { createAssistantTools } from "@/lib/assistant-tools";
import { PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

describe("Assistant roadblock action proposals", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  async function createConversation(userId: string) {
    return prisma.assistantConversation.create({
      data: {
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        createdById: userId,
        title: "Assistant action test",
      },
    });
  }

  async function createTask(name: string, roadblock = false) {
    return prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name,
        startDate: new Date("2026-04-01"),
        endDate: new Date("2026-04-10"),
        isRoadblock: roadblock,
        roadblockStatus: roadblock ? "OPEN" : null,
        roadblockNote: roadblock ? "Original roadblock" : null,
        roadblockType: roadblock ? "OTHER" : null,
      },
    });
  }

  it("creates a renderable proposal directly from natural task and owner names", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    await createTask("Rough electrical wiring");
    const proposalTool = createAssistantTools({
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
      conversationId: conversation.id,
      focusProjectId: fixture.project.id,
    }).proposeRoadblockChange;

    const output = await proposalTool.execute!(
      {
        taskName: "Rough electrical wiring",
        note: "City inspection is pending",
        roadblockType: "INSPECTION",
        ownerName: fixture.superintendent.user.name,
      },
      { toolCallId: "natural-name-test", messages: [], context: {} }
    );

    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: {
        status: "PENDING",
        taskName: "Rough electrical wiring",
      },
    });
  });

  it("does not mutate until confirmation and confirms idempotently with one audit entry", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const task = await createTask("Confirm roadblock task");
    const context = {
      organizationId: fixture.organization.id,
      userId: fixture.trade.user.id,
    };

    const output = await createRoadblockActionProposal(
      {
        conversationId: conversation.id,
        taskId: task.id,
        note: "Permit approval is blocking mobilization",
        roadblockType: "INSPECTION",
        ownerMemberId: fixture.superintendent.member.id,
        dueDate: "2026-04-04",
      },
      context
    );

    expect(output.kind).toBe("action-proposal");
    expect(output.proposal.status).toBe("PENDING");
    const beforeConfirmation = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(beforeConfirmation.isRoadblock).toBe(false);

    const confirmed = await confirmAssistantAction(output.proposal.id, context);
    expect(confirmed.status).toBe("CONFIRMED");
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated).toMatchObject({
      isRoadblock: true,
      roadblockStatus: "OPEN",
      roadblockNote: "Permit approval is blocking mobilization",
      roadblockType: "INSPECTION",
      roadblockOwnerId: fixture.superintendent.member.id,
    });

    const confirmedAgain = await confirmAssistantAction(output.proposal.id, context);
    expect(confirmedAgain.status).toBe("CONFIRMED");
    const auditEntries = await prisma.activityLogEntry.count({
      where: { taskId: task.id, action: "assistant_roadblock_flagged" },
    });
    expect(auditEntries).toBe(1);
  });

  it("cancels without changing the task and cannot later be confirmed", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const task = await createTask("Cancelled roadblock task");
    const context = {
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
    };
    const output = await createRoadblockActionProposal(
      {
        conversationId: conversation.id,
        taskId: task.id,
        note: "Material delivery is late",
        roadblockType: "MATERIAL",
      },
      context
    );

    const cancelled = await cancelAssistantAction(output.proposal.id, context);
    expect(cancelled.status).toBe("CANCELLED");
    await expect(confirmAssistantAction(output.proposal.id, context)).rejects.toMatchObject({
      status: 409,
    });
    const unchanged = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(unchanged.isRoadblock).toBe(false);
  });

  it("rejects confirmation when roadblock fields changed after the proposal", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const task = await createTask("Stale roadblock task");
    const context = {
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
    };
    const output = await createRoadblockActionProposal(
      {
        conversationId: conversation.id,
        taskId: task.id,
        note: "Waiting for city inspection",
        roadblockType: "INSPECTION",
      },
      context
    );

    await prisma.task.update({
      where: { id: task.id },
      data: {
        isRoadblock: true,
        roadblockStatus: "OPEN",
        roadblockNote: "A teammate flagged this first",
        roadblockType: "OTHER",
      },
    });

    await expect(confirmAssistantAction(output.proposal.id, context)).rejects.toThrow(
      /changed after the proposal/i
    );
    const proposal = await prisma.assistantActionProposal.findUniqueOrThrow({
      where: { id: output.proposal.id },
    });
    expect(proposal.status).toBe("PENDING");
  });

  it("requires schedule-edit access to propose changes to an existing roadblock", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const task = await createTask("Restricted existing roadblock", true);

    await expect(
      createRoadblockActionProposal(
        {
          conversationId: conversation.id,
          taskId: task.id,
          ownerMemberId: fixture.superintendent.member.id,
        },
        {
          organizationId: fixture.organization.id,
          userId: fixture.trade.user.id,
        }
      )
    ).rejects.toBeInstanceOf(PermissionError);
  });
});
