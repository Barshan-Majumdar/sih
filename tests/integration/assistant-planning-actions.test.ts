import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AssistantActionError,
  confirmAssistantAction,
  createBaselineActionProposal,
  createScheduleImpactActionProposal,
} from "@/lib/assistant-actions";
import { createAssistantTools } from "@/lib/assistant-tools";
import { PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

describe("Assistant planning action proposals", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  function createConversation(userId: string) {
    return prisma.assistantConversation.create({
      data: {
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        createdById: userId,
        title: "Assistant planning action test",
      },
    });
  }

  function createTask(name: string) {
    return prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name,
        startDate: new Date("2026-09-01T12:00:00.000Z"),
        endDate: new Date("2026-09-05T12:00:00.000Z"),
      },
    });
  }

  it("creates and reviews a schedule impact request through confirmations", async () => {
    const task = await createTask("Impact-linked task");
    const tradeConversation = await createConversation(fixture.trade.user.id);
    const tradeContext = { organizationId: fixture.organization.id, userId: fixture.trade.user.id };
    const createOutput = await createScheduleImpactActionProposal(
      {
        conversationId: tradeConversation.id,
        projectId: fixture.project.id,
        operation: "CREATE",
        taskId: task.id,
        description: "Rain delay affected exterior framing",
        proposedNewEndDate: "2026-09-08",
      },
      tradeContext
    );

    expect(createOutput).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Create impact request", status: "PENDING" },
    });
    await confirmAssistantAction(createOutput.proposal.id, tradeContext);
    const sir = await prisma.scheduleImpactRequest.findFirstOrThrow({
      where: { projectId: fixture.project.id, description: "Rain delay affected exterior framing" },
    });
    expect(sir).toMatchObject({ taskId: task.id, status: "PENDING" });

    const pmConversation = await createConversation(fixture.pm.user.id);
    const pmContext = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const reviewOutput = await createScheduleImpactActionProposal(
      {
        conversationId: pmConversation.id,
        projectId: fixture.project.id,
        operation: "REVIEW",
        sirId: sir.id,
        status: "APPROVED",
        reviewNote: "Approved per weather log",
      },
      pmContext
    );
    await confirmAssistantAction(reviewOutput.proposal.id, pmContext);
    await confirmAssistantAction(reviewOutput.proposal.id, pmContext);

    expect(await prisma.scheduleImpactRequest.findUniqueOrThrow({ where: { id: sir.id } })).toMatchObject({
      status: "APPROVED",
      reviewNote: "Approved per weather log",
    });
    expect((await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).endDate.toISOString()).toBe(
      "2026-09-08T12:00:00.000Z"
    );
    expect(
      await prisma.activityLogEntry.count({
        where: { projectId: fixture.project.id, action: "assistant_sir_reviewed" },
      })
    ).toBe(1);
  });

  it("resolves schedule impact requests by natural text and enforces review permissions", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    await prisma.scheduleImpactRequest.create({
      data: {
        projectId: fixture.project.id,
        description: "Owner direction delayed slab pour",
        submittedById: fixture.trade.member.id,
      },
    });
    const output = await createAssistantTools({
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
      conversationId: conversation.id,
      focusProjectId: fixture.project.id,
    }).proposeScheduleImpactChange.execute!(
      {
        operation: "REVIEW",
        description: "Owner direction delayed slab pour",
        status: "REJECTED",
        reviewNote: "No schedule impact documented",
      },
      { toolCallId: "sir-review-natural", messages: [], context: {} }
    );
    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Reject impact request", status: "PENDING" },
    });

    const tradeConversation = await createConversation(fixture.trade.user.id);
    const sir = await prisma.scheduleImpactRequest.create({
      data: {
        projectId: fixture.project.id,
        description: "Restricted review request",
        submittedById: fixture.trade.member.id,
      },
    });
    await expect(
      createScheduleImpactActionProposal(
        {
          conversationId: tradeConversation.id,
          projectId: fixture.project.id,
          operation: "REVIEW",
          sirId: sir.id,
          status: "APPROVED",
        },
        { organizationId: fixture.organization.id, userId: fixture.trade.user.id }
      )
    ).rejects.toBeInstanceOf(AssistantActionError);
  });

  it("rejects invalid impact dates and prevents a reviewed request from being reviewed again", async () => {
    const task = await createTask("Impact validation task");
    const tradeConversation = await createConversation(fixture.trade.user.id);
    const tradeContext = { organizationId: fixture.organization.id, userId: fixture.trade.user.id };

    await expect(
      createScheduleImpactActionProposal(
        {
          conversationId: tradeConversation.id,
          projectId: fixture.project.id,
          operation: "CREATE",
          taskId: task.id,
          description: "Invalid calendar date",
          proposedNewEndDate: "2026-02-30",
        },
        tradeContext
      )
    ).rejects.toBeInstanceOf(AssistantActionError);
    await expect(
      createScheduleImpactActionProposal(
        {
          conversationId: tradeConversation.id,
          projectId: fixture.project.id,
          operation: "CREATE",
          taskId: task.id,
          description: "Finish before task start",
          proposedNewEndDate: "2026-08-31",
        },
        tradeContext
      )
    ).rejects.toBeInstanceOf(AssistantActionError);

    const reviewed = await prisma.scheduleImpactRequest.create({
      data: {
        projectId: fixture.project.id,
        taskId: task.id,
        description: "Already reviewed request",
        submittedById: fixture.trade.member.id,
        status: "APPROVED",
        reviewedById: fixture.pm.member.id,
        reviewedAt: new Date(),
      },
    });
    const pmConversation = await createConversation(fixture.pm.user.id);
    await expect(
      createScheduleImpactActionProposal(
        {
          conversationId: pmConversation.id,
          projectId: fixture.project.id,
          operation: "REVIEW",
          sirId: reviewed.id,
          status: "REJECTED",
        },
        { organizationId: fixture.organization.id, userId: fixture.pm.user.id }
      )
    ).rejects.toBeInstanceOf(AssistantActionError);
  });

  it("rejects an impact review when the linked task schedule changes before confirmation", async () => {
    const task = await createTask("Impact stale task");
    const sir = await prisma.scheduleImpactRequest.create({
      data: {
        projectId: fixture.project.id,
        taskId: task.id,
        description: "Task schedule may change",
        proposedNewEndDate: new Date("2026-09-10T12:00:00.000Z"),
        submittedById: fixture.trade.member.id,
      },
    });
    const conversation = await createConversation(fixture.pm.user.id);
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const output = await createScheduleImpactActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "REVIEW",
        sirId: sir.id,
        status: "APPROVED",
      },
      context
    );

    await prisma.task.update({
      where: { id: task.id },
      data: { endDate: new Date("2026-09-07T12:00:00.000Z") },
    });
    await expect(confirmAssistantAction(output.proposal.id, context)).rejects.toBeInstanceOf(
      AssistantActionError
    );
  });

  it("creates a baseline only after confirmation and rejects stale task lists", async () => {
    const task = await createTask("Baseline task");
    const conversation = await createConversation(fixture.scheduler.user.id);
    const context = { organizationId: fixture.organization.id, userId: fixture.scheduler.user.id };
    const output = await createBaselineActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "CREATE",
        name: "Owner-approved baseline",
      },
      context
    );
    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Create baseline", status: "PENDING" },
    });
    expect(await prisma.baseline.count({ where: { projectId: fixture.project.id, name: "Owner-approved baseline" } })).toBe(0);

    await confirmAssistantAction(output.proposal.id, context);
    await confirmAssistantAction(output.proposal.id, context);
    const baseline = await prisma.baseline.findFirstOrThrow({
      where: { projectId: fixture.project.id, name: "Owner-approved baseline" },
      include: { snapshots: true },
    });
    expect(baseline.snapshots.some((snapshot) => snapshot.taskId === task.id)).toBe(true);
    expect(
      await prisma.activityLogEntry.count({
        where: { projectId: fixture.project.id, action: "assistant_baseline_created" },
      })
    ).toBe(1);

    const staleOutput = await createBaselineActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "CREATE",
        name: "Stale baseline",
      },
      context
    );
    await createTask("Baseline late-added task");
    await expect(confirmAssistantAction(staleOutput.proposal.id, context)).rejects.toBeInstanceOf(
      AssistantActionError
    );
  });

  it("compares the current schedule to a baseline through confirmation", async () => {
    const task = await createTask("Compare baseline task");
    const conversation = await createConversation(fixture.pm.user.id);
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const createOutput = await createBaselineActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "CREATE",
        name: "Compare-ready baseline",
      },
      context
    );
    await confirmAssistantAction(createOutput.proposal.id, context);

    await prisma.task.update({
      where: { id: task.id },
      data: { endDate: new Date("2026-09-12T12:00:00.000Z") },
    });

    const compareOutput = await createBaselineActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "COMPARE",
        name: "Compare-ready baseline",
      },
      context
    );
    expect(compareOutput).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Compare baseline", status: "PENDING" },
    });
    expect(compareOutput.proposal.changes.some((change) => change.field === "slippedCount")).toBe(true);

    await confirmAssistantAction(compareOutput.proposal.id, context);
    expect(
      await prisma.activityLogEntry.count({
        where: { projectId: fixture.project.id, action: "assistant_baseline_compared" },
      })
    ).toBe(1);
  });

  it("requires schedule-edit permission for baseline creation but allows members to compare", async () => {
    await createTask("Restricted baseline task");
    const conversation = await createConversation(fixture.trade.user.id);
    await expect(
      createBaselineActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          operation: "CREATE",
          name: "Trade baseline",
        },
        { organizationId: fixture.organization.id, userId: fixture.trade.user.id }
      )
    ).rejects.toBeInstanceOf(PermissionError);

    const schedulerConversation = await createConversation(fixture.scheduler.user.id);
    const createOutput = await createBaselineActionProposal(
      {
        conversationId: schedulerConversation.id,
        projectId: fixture.project.id,
        operation: "CREATE",
        name: "Member-compare baseline",
      },
      { organizationId: fixture.organization.id, userId: fixture.scheduler.user.id }
    );
    await confirmAssistantAction(createOutput.proposal.id, {
      organizationId: fixture.organization.id,
      userId: fixture.scheduler.user.id,
    });

    const compareOutput = await createBaselineActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "COMPARE",
        name: "Member-compare baseline",
      },
      { organizationId: fixture.organization.id, userId: fixture.trade.user.id }
    );
    expect(compareOutput).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Compare baseline", status: "PENDING" },
    });
  });
});
