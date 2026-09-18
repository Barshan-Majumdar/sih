import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AssistantActionError,
  confirmAssistantAction,
  createTaskActionProposal,
  createTaskProgressActionProposal,
  createWeeklyCommitmentActionProposal,
} from "@/lib/assistant-actions";
import { createAssistantTools } from "@/lib/assistant-tools";
import { PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

describe("Assistant task action proposals", () => {
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
        title: "Assistant task action test",
      },
    });
  }

  function createTask(name: string, assignedToId?: string) {
    return prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name,
        assignedToId,
        startDate: new Date("2026-07-20T12:00:00.000Z"),
        endDate: new Date("2026-07-24T12:00:00.000Z"),
        status: "NOT_STARTED",
        progress: 0,
      },
    });
  }

  it("resolves natural task and assignee names into a renderable proposal", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    await createTask("Natural language schedule task");
    const tool = createAssistantTools({
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
      conversationId: conversation.id,
      focusProjectId: fixture.project.id,
    }).proposeTaskChange;

    const output = await tool.execute!(
      {
        operation: "UPDATE",
        taskName: "Natural language schedule task",
        assignedToName: fixture.superintendent.user.name,
        progress: 45,
      },
      { toolCallId: "natural-task-change", messages: [], context: {} }
    );

    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: {
        actionLabel: "Update task",
        status: "PENDING",
        taskName: "Natural language schedule task",
      },
    });
  });

  it("creates a task only after confirmation and confirms idempotently", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const output = await createTaskActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "CREATE",
        name: "Level 2 framing",
        assignedToId: fixture.superintendent.member.id,
        startDate: "2026-07-27",
        endDate: "2026-07-31",
        progress: 40,
        note: "Coordinate the north elevation first",
      },
      context
    );

    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Create task", status: "PENDING", hrefLabel: "Open schedule" },
    });
    expect(await prisma.task.count({ where: { projectId: fixture.project.id, name: "Level 2 framing" } })).toBe(0);

    const confirmed = await confirmAssistantAction(output.proposal.id, context);
    expect(confirmed).toMatchObject({ status: "CONFIRMED", hrefLabel: "Open task" });
    const task = await prisma.task.findFirstOrThrow({
      where: { projectId: fixture.project.id, name: "Level 2 framing" },
      include: { updates: true },
    });
    expect(task).toMatchObject({
      assignedToId: fixture.superintendent.member.id,
      status: "IN_PROGRESS",
      progress: 40,
    });
    expect(task.updates).toHaveLength(1);
    expect(task.updates[0].note).toBe("Coordinate the north elevation first");

    await confirmAssistantAction(output.proposal.id, context);
    expect(await prisma.task.count({ where: { projectId: fixture.project.id, name: "Level 2 framing" } })).toBe(1);
    expect(await prisma.activityLogEntry.count({ where: { taskId: task.id, action: "assistant_task_created" } })).toBe(1);
  });

  it("applies dates, status, progress, assignment, and a note as one update", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const task = await createTask("Consolidated task update");
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const output = await createTaskActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "UPDATE",
        taskId: task.id,
        assignedToId: fixture.trade.member.id,
        startDate: "2026-07-22",
        endDate: "2026-07-29",
        status: "IN_PROGRESS",
        progress: 35,
        note: "Crew mobilized on the east side",
      },
      context
    );

    const before = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(before.progress).toBe(0);
    await confirmAssistantAction(output.proposal.id, context);
    const updated = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      include: { updates: true },
    });
    expect(updated).toMatchObject({
      assignedToId: fixture.trade.member.id,
      status: "IN_PROGRESS",
      progress: 35,
    });
    expect(updated.startDate.toISOString()).toBe("2026-07-22T12:00:00.000Z");
    expect(updated.endDate.toISOString()).toBe("2026-07-29T12:00:00.000Z");
    expect(updated.updates.at(-1)?.note).toBe("Crew mobilized on the east side");
  });

  it("rejects a stale update proposal", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const task = await createTask("Stale task update");
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const output = await createTaskActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "UPDATE",
        taskId: task.id,
        progress: 60,
      },
      context
    );

    await prisma.task.update({ where: { id: task.id }, data: { status: "DELAYED" } });
    await expect(confirmAssistantAction(output.proposal.id, context)).rejects.toBeInstanceOf(
      AssistantActionError
    );
    const proposal = await prisma.assistantActionProposal.findUniqueOrThrow({
      where: { id: output.proposal.id },
    });
    expect(proposal.status).toBe("PENDING");
  });

  it("allows an assigned trade to report progress but not reschedule the task", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const task = await createTask("Trade progress task", fixture.trade.member.id);
    const context = { organizationId: fixture.organization.id, userId: fixture.trade.user.id };

    const progressProposal = await createTaskActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "UPDATE",
        taskId: task.id,
        progress: 25,
        note: "Layout is complete",
      },
      context
    );
    await confirmAssistantAction(progressProposal.proposal.id, context);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      status: "IN_PROGRESS",
      progress: 25,
    });

    await expect(
      createTaskActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          operation: "UPDATE",
          taskId: task.id,
          endDate: "2026-08-03",
        },
        context
      )
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("records actual dates and percent complete only after confirmation", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const task = await createTask("Actual progress task", fixture.trade.member.id);
    const context = { organizationId: fixture.organization.id, userId: fixture.trade.user.id };

    const output = await createTaskProgressActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        taskId: task.id,
        actualStartDate: "2026-07-21",
        actualFinishDate: "2026-07-25",
        progress: 100,
        note: "Crew finished punch items",
      },
      context
    );

    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Update progress", status: "PENDING" },
    });
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      actualStartDate: null,
      actualFinishDate: null,
      progress: 0,
    });

    await confirmAssistantAction(output.proposal.id, context);
    const updated = await prisma.task.findUniqueOrThrow({
      where: { id: task.id },
      include: { updates: true },
    });
    expect(updated).toMatchObject({ status: "DONE", progress: 100 });
    expect(updated.actualStartDate?.toISOString()).toBe("2026-07-21T12:00:00.000Z");
    expect(updated.actualFinishDate?.toISOString()).toBe("2026-07-25T12:00:00.000Z");
    expect(updated.updates.at(-1)?.note).toBe("Crew finished punch items");

    await confirmAssistantAction(output.proposal.id, context);
    expect(await prisma.activityLogEntry.count({ where: { taskId: task.id, action: "assistant_task_progress_updated" } })).toBe(1);
  });

  it("rejects stale actual progress proposals", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const task = await createTask("Stale progress task");
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const output = await createTaskProgressActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        taskId: task.id,
        progress: 50,
      },
      context
    );

    await prisma.task.update({ where: { id: task.id }, data: { progress: 10 } });
    await expect(confirmAssistantAction(output.proposal.id, context)).rejects.toBeInstanceOf(
      AssistantActionError
    );
  });

  it("normalizes an actual finish to Done and 100 percent", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const task = await createTask("Finish normalization task");
    await prisma.task.update({
      where: { id: task.id },
      data: {
        actualStartDate: new Date("2026-07-21T12:00:00.000Z"),
        status: "IN_PROGRESS",
        progress: 70,
      },
    });
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };

    const output = await createTaskProgressActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        taskId: task.id,
        actualFinishDate: "2026-07-25",
      },
      context
    );
    expect(output.proposal.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "actualFinishDate" }),
        expect.objectContaining({ field: "taskStatus", after: "Done" }),
        expect.objectContaining({ field: "progress", after: "100%" }),
      ])
    );

    await confirmAssistantAction(output.proposal.id, context);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      status: "DONE",
      progress: 100,
      actualStartDate: new Date("2026-07-21T12:00:00.000Z"),
      actualFinishDate: new Date("2026-07-25T12:00:00.000Z"),
    });
  });

  it("rejects inconsistent progress states and invalid actual dates", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const task = await createTask("Progress invariant task");
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };

    await expect(
      createTaskProgressActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          taskId: task.id,
          status: "DONE",
          progress: 80,
        },
        context
      )
    ).rejects.toThrow("A completed task must be 100% complete.");

    await expect(
      createTaskProgressActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          taskId: task.id,
          actualFinishDate: "2026-07-25",
        },
        context
      )
    ).rejects.toThrow("Set the actual start before recording the actual finish.");

    await expect(
      createTaskProgressActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          taskId: task.id,
          actualStartDate: "2026-02-31",
        },
        context
      )
    ).rejects.toThrow("Use a valid actual start date.");
  });

  it("allows only the assigned trade to propose field progress", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const assignedTask = await createTask("Assigned field progress", fixture.trade.member.id);
    const unassignedTask = await createTask("Unassigned field progress");
    const context = { organizationId: fixture.organization.id, userId: fixture.trade.user.id };

    await expect(
      createTaskProgressActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          taskId: assignedTask.id,
          progress: 35,
        },
        context
      )
    ).resolves.toMatchObject({ kind: "action-proposal" });

    await expect(
      createTaskProgressActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          taskId: unassignedTask.id,
          progress: 35,
        },
        context
      )
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("creates and completes weekly commitments through confirmation", async () => {
    const conversation = await createConversation(fixture.superintendent.user.id);
    const task = await createTask("Weekly commitment task", fixture.trade.member.id);
    const context = { organizationId: fixture.organization.id, userId: fixture.superintendent.user.id };

    const createOutput = await createWeeklyCommitmentActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "CREATE",
        taskId: task.id,
        weekStartDate: "2026-07-29",
      },
      context
    );
    expect(createOutput).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Commit task", status: "PENDING" },
    });
    await confirmAssistantAction(createOutput.proposal.id, context);

    const commitment = await prisma.weeklyCommitment.findUniqueOrThrow({
      where: { taskId_weekStartDate: { taskId: task.id, weekStartDate: new Date("2026-07-27T12:00:00.000Z") } },
    });
    expect(commitment.status).toBe("COMMITTED");

    const completeOutput = await createWeeklyCommitmentActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "UPDATE_STATUS",
        commitmentId: commitment.id,
        status: "COMPLETED",
      },
      context
    );
    expect(completeOutput.proposal.actionLabel).toBe("Complete commitment");
    await confirmAssistantAction(completeOutput.proposal.id, context);
    expect(await prisma.weeklyCommitment.findUniqueOrThrow({ where: { id: commitment.id } })).toMatchObject({
      status: "COMPLETED",
      reasonForVariance: null,
    });

    await confirmAssistantAction(completeOutput.proposal.id, context);
    expect(await prisma.activityLogEntry.count({ where: { taskId: task.id, action: "assistant_commitment_status_changed" } })).toBe(1);
  });

  it("requires, saves, and audits a variance reason and rejects stale proposals", async () => {
    const conversation = await createConversation(fixture.superintendent.user.id);
    const task = await createTask("Variance commitment task", fixture.trade.member.id);
    const commitment = await prisma.weeklyCommitment.create({
      data: {
        taskId: task.id,
        weekStartDate: new Date("2026-08-03T12:00:00.000Z"),
        committedById: fixture.trade.member.id,
      },
    });
    const context = { organizationId: fixture.organization.id, userId: fixture.superintendent.user.id };

    await expect(
      createWeeklyCommitmentActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          operation: "UPDATE_STATUS",
          commitmentId: commitment.id,
          status: "NOT_COMPLETED",
        },
        context
      )
    ).rejects.toBeInstanceOf(AssistantActionError);

    const output = await createWeeklyCommitmentActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "UPDATE_STATUS",
        commitmentId: commitment.id,
        status: "NOT_COMPLETED",
        reasonForVariance: "Inspection hold",
      },
      context
    );
    expect(output.proposal.actionLabel).toBe("Record incomplete commitment");
    await confirmAssistantAction(output.proposal.id, context);
    expect(await prisma.weeklyCommitment.findUniqueOrThrow({ where: { id: commitment.id } })).toMatchObject({
      status: "NOT_COMPLETED",
      reasonForVariance: "Inspection hold",
    });
    expect(
      await prisma.activityLogEntry.findFirstOrThrow({
        where: { taskId: task.id, action: "assistant_commitment_status_changed" },
        orderBy: { createdAt: "desc" },
      })
    ).toMatchObject({ detail: expect.stringContaining("Inspection hold") });

    const staleOutput = await createWeeklyCommitmentActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "UPDATE_STATUS",
        commitmentId: commitment.id,
        status: "COMPLETED",
      },
      context
    );
    await prisma.weeklyCommitment.update({ where: { id: commitment.id }, data: { status: "COMMITTED" } });
    await expect(confirmAssistantAction(staleOutput.proposal.id, context)).rejects.toBeInstanceOf(
      AssistantActionError
    );
  });

  it("resolves commitment updates from any date within the requested week", async () => {
    const conversation = await createConversation(fixture.superintendent.user.id);
    const task = await createTask("Canonical week commitment", fixture.trade.member.id);
    await prisma.weeklyCommitment.create({
      data: {
        taskId: task.id,
        weekStartDate: new Date("2026-08-03T12:00:00.000Z"),
        committedById: fixture.trade.member.id,
      },
    });
    const tool = createAssistantTools({
      organizationId: fixture.organization.id,
      userId: fixture.superintendent.user.id,
      conversationId: conversation.id,
      focusProjectId: fixture.project.id,
    }).proposeWeeklyCommitmentChange;

    const output = await tool.execute!(
      {
        operation: "UPDATE_STATUS",
        taskName: task.name,
        weekStartDate: "2026-08-05",
        status: "COMPLETED",
      },
      { toolCallId: "canonical-week-update", messages: [], context: {} }
    );
    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Complete commitment", status: "PENDING" },
    });
  });

  it("allows assigned trades to commit their work and rejects unauthorized roles", async () => {
    const tradeConversation = await createConversation(fixture.trade.user.id);
    const assignedTask = await createTask("Trade-owned commitment", fixture.trade.member.id);
    const unassignedTask = await createTask("Other trade commitment", fixture.superintendent.member.id);
    const tradeContext = { organizationId: fixture.organization.id, userId: fixture.trade.user.id };

    const allowed = await createWeeklyCommitmentActionProposal(
      {
        conversationId: tradeConversation.id,
        projectId: fixture.project.id,
        operation: "CREATE",
        taskId: assignedTask.id,
        weekStartDate: "2026-08-10",
      },
      tradeContext
    );
    await confirmAssistantAction(allowed.proposal.id, tradeContext);
    expect(
      await prisma.weeklyCommitment.count({ where: { taskId: assignedTask.id } })
    ).toBe(1);

    await expect(
      createWeeklyCommitmentActionProposal(
        {
          conversationId: tradeConversation.id,
          projectId: fixture.project.id,
          operation: "CREATE",
          taskId: unassignedTask.id,
          weekStartDate: "2026-08-10",
        },
        tradeContext
      )
    ).rejects.toBeInstanceOf(PermissionError);

    const schedulerConversation = await createConversation(fixture.scheduler.user.id);
    await expect(
      createWeeklyCommitmentActionProposal(
        {
          conversationId: schedulerConversation.id,
          projectId: fixture.project.id,
          operation: "CREATE",
          taskId: assignedTask.id,
          weekStartDate: "2026-08-17",
        },
        { organizationId: fixture.organization.id, userId: fixture.scheduler.user.id }
      )
    ).rejects.toBeInstanceOf(PermissionError);
  });

  it("soft-removes and restores a future commitment through confirmation", async () => {
    const conversation = await createConversation(fixture.superintendent.user.id);
    const task = await createTask("Removable future commitment", fixture.trade.member.id);
    const context = { organizationId: fixture.organization.id, userId: fixture.superintendent.user.id };
    const weekStartDate = new Date("2026-09-14T12:00:00.000Z");
    const commitment = await prisma.weeklyCommitment.create({
      data: { taskId: task.id, weekStartDate, committedById: fixture.trade.member.id },
    });

    const removeOutput = await createWeeklyCommitmentActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "REMOVE",
        commitmentId: commitment.id,
        removalReason: "Scope moved out of the weekly plan",
      },
      context
    );
    expect(removeOutput.proposal).toMatchObject({ actionLabel: "Remove from plan", status: "PENDING" });
    await confirmAssistantAction(removeOutput.proposal.id, context);

    const removed = await prisma.weeklyCommitment.findUniqueOrThrow({ where: { id: commitment.id } });
    expect(removed).toMatchObject({
      status: "COMMITTED",
      removedById: fixture.superintendent.user.id,
      removalReason: "Scope moved out of the weekly plan",
    });
    expect(removed.removedAt).toBeInstanceOf(Date);
    expect(
      await prisma.activityLogEntry.count({ where: { taskId: task.id, action: "assistant_commitment_removed" } })
    ).toBe(1);

    const restoreOutput = await createWeeklyCommitmentActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "CREATE",
        taskId: task.id,
        weekStartDate: "2026-09-14",
      },
      context
    );
    await confirmAssistantAction(restoreOutput.proposal.id, context);
    const restored = await prisma.weeklyCommitment.findUniqueOrThrow({ where: { id: commitment.id } });
    expect(restored).toMatchObject({ removedAt: null, removedById: null, removalReason: null });
    expect(await prisma.weeklyCommitment.count({ where: { taskId: task.id, weekStartDate } })).toBe(1);
  });

  it("rejects removal for current-week and completed commitments", async () => {
    const conversation = await createConversation(fixture.superintendent.user.id);
    const context = { organizationId: fixture.organization.id, userId: fixture.superintendent.user.id };
    const currentTask = await createTask("Current commitment cannot be removed", fixture.trade.member.id);
    const completedTask = await createTask("Completed commitment cannot be removed", fixture.trade.member.id);
    const currentCommitment = await prisma.weeklyCommitment.create({
      data: {
        taskId: currentTask.id,
        weekStartDate: new Date("2026-07-13T12:00:00.000Z"),
        committedById: fixture.trade.member.id,
      },
    });
    const completedCommitment = await prisma.weeklyCommitment.create({
      data: {
        taskId: completedTask.id,
        weekStartDate: new Date("2026-09-21T12:00:00.000Z"),
        committedById: fixture.trade.member.id,
        status: "COMPLETED",
      },
    });

    for (const commitmentId of [currentCommitment.id, completedCommitment.id]) {
      await expect(
        createWeeklyCommitmentActionProposal(
          {
            conversationId: conversation.id,
            projectId: fixture.project.id,
            operation: "REMOVE",
            commitmentId,
          },
          context
        )
      ).rejects.toBeInstanceOf(AssistantActionError);
    }
  });
});
