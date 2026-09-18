import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AssistantActionError,
  confirmAssistantAction,
  createScheduleActionProposal,
} from "@/lib/assistant-actions";
import { createAssistantTools } from "@/lib/assistant-tools";
import { PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

describe("Assistant schedule action proposals", () => {
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
        title: "Assistant schedule action test",
      },
    });
  }

  function createTask(name: string, start: string, end: string) {
    return prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name,
        startDate: new Date(`${start}T12:00:00.000Z`),
        endDate: new Date(`${end}T12:00:00.000Z`),
      },
    });
  }

  it("resolves natural names and confirms a dependency exactly once", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const predecessor = await createTask("Dependency predecessor", "2026-07-01", "2026-07-05");
    const successor = await createTask("Dependency successor", "2026-07-06", "2026-07-10");
    const tools = createAssistantTools({
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
      conversationId: conversation.id,
      focusProjectId: fixture.project.id,
    });
    const output = await tools.proposeScheduleChange.execute!(
      {
        operation: "ADD_DEPENDENCY",
        predecessorTaskName: predecessor.name,
        successorTaskName: successor.name,
      },
      { toolCallId: "dependency-test", messages: [], context: {} }
    );

    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Add dependency", status: "PENDING" },
    });
    if (!output || typeof output !== "object" || !("proposal" in output)) {
      throw new Error("Expected an action proposal");
    }
    expect(
      await prisma.taskDependency.count({
        where: { predecessorId: predecessor.id, successorId: successor.id },
      })
    ).toBe(0);

    await confirmAssistantAction(output.proposal.id, {
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
    });
    await confirmAssistantAction(output.proposal.id, {
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
    });
    expect(
      await prisma.taskDependency.count({
        where: { predecessorId: predecessor.id, successorId: successor.id },
      })
    ).toBe(1);
    expect(
      await prisma.activityLogEntry.count({
        where: { taskId: successor.id, action: "assistant_dependency_added" },
      })
    ).toBe(1);
  });

  it("blocks a circular dependency before creating a proposal", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const first = await createTask("Cycle first", "2026-07-11", "2026-07-12");
    const second = await createTask("Cycle second", "2026-07-13", "2026-07-14");
    await prisma.taskDependency.create({
      data: { predecessorId: first.id, successorId: second.id },
    });

    await expect(
      createScheduleActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          operation: "ADD_DEPENDENCY",
          predecessorId: second.id,
          successorId: first.id,
        },
        { organizationId: fixture.organization.id, userId: fixture.pm.user.id }
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it("shifts multiple tasks atomically and records each affected task", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const first = await createTask("Bulk shift first", "2026-07-15", "2026-07-17");
    const second = await createTask("Bulk shift second", "2026-07-18", "2026-07-20");
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const output = await createScheduleActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "SHIFT_TASKS",
        taskIds: [first.id, second.id],
        shiftDays: 3,
      },
      context
    );

    expect(output.proposal.changes).toHaveLength(2);
    await confirmAssistantAction(output.proposal.id, context);
    const shifted = await prisma.task.findMany({
      where: { id: { in: [first.id, second.id] } },
      orderBy: { name: "asc" },
    });
    expect(shifted[0].startDate.toISOString()).toBe("2026-07-18T12:00:00.000Z");
    expect(shifted[1].startDate.toISOString()).toBe("2026-07-21T12:00:00.000Z");
    expect(
      await prisma.activityLogEntry.count({
        where: { taskId: { in: [first.id, second.id] }, action: "assistant_task_rescheduled" },
      })
    ).toBe(2);
  });

  it("previews and atomically confirms a dependency-aware downstream reflow", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const inspection = await createTask("What-if inspection", "2026-09-01", "2026-09-05");
    const drywall = await createTask("What-if drywall", "2026-09-05", "2026-09-08");
    const paint = await createTask("What-if paint", "2026-09-08", "2026-09-10");
    await prisma.taskDependency.createMany({
      data: [
        { predecessorId: inspection.id, successorId: drywall.id },
        { predecessorId: drywall.id, successorId: paint.id },
      ],
    });
    const tools = createAssistantTools({
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
      conversationId: conversation.id,
      focusProjectId: fixture.project.id,
    });
    const output = await tools.proposeScheduleChange.execute!(
      {
        operation: "REFLOW_SUCCESSORS",
        anchorTaskName: inspection.name,
        newEndDate: "2026-09-08",
      },
      { toolCallId: "what-if-reflow-test", messages: [], context: {} }
    );

    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: {
        actionLabel: "Reflow schedule",
        status: "PENDING",
        taskName: inspection.name,
      },
    });
    if (!output || typeof output !== "object" || !("proposal" in output)) {
      throw new Error("Expected a what-if action proposal");
    }
    expect(output.proposal.changes.some((change) => change.label === "Project finish")).toBe(true);
    expect(output.proposal.changes.some((change) => change.label === paint.name)).toBe(true);
    expect((await prisma.task.findUniqueOrThrow({ where: { id: paint.id } })).endDate.toISOString()).toBe(
      "2026-09-10T12:00:00.000Z"
    );

    await confirmAssistantAction(output.proposal.id, {
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
    });
    const reflowed = await prisma.task.findMany({
      where: { id: { in: [inspection.id, drywall.id, paint.id] } },
      orderBy: { startDate: "asc" },
    });
    expect(reflowed.map((task) => task.startDate.toISOString().slice(0, 10))).toEqual([
      "2026-09-04",
      "2026-09-08",
      "2026-09-11",
    ]);
    expect(
      await prisma.activityLogEntry.count({
        where: {
          taskId: { in: [inspection.id, drywall.id, paint.id] },
          action: "assistant_task_rescheduled",
        },
      })
    ).toBe(3);
  });

  it("rejects a what-if reflow that would move completed downstream work", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const anchor = await createTask("Completed-chain anchor", "2026-10-01", "2026-10-05");
    const completed = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Completed-chain successor",
        startDate: new Date("2026-10-05T12:00:00.000Z"),
        endDate: new Date("2026-10-08T12:00:00.000Z"),
        status: "DONE",
        progress: 100,
      },
    });
    await prisma.taskDependency.create({
      data: { predecessorId: anchor.id, successorId: completed.id },
    });

    await expect(
      createScheduleActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          operation: "REFLOW_SUCCESSORS",
          anchorTaskId: anchor.id,
          shiftDays: 2,
        },
        { organizationId: fixture.organization.id, userId: fixture.pm.user.id }
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it("rejects confirmation when an affected task becomes stale", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const task = await createTask("Stale schedule shift", "2026-07-21", "2026-07-23");
    const context = { organizationId: fixture.organization.id, userId: fixture.pm.user.id };
    const output = await createScheduleActionProposal(
      {
        conversationId: conversation.id,
        projectId: fixture.project.id,
        operation: "SHIFT_TASKS",
        taskIds: [task.id],
        shiftDays: 2,
      },
      context
    );
    await prisma.task.update({
      where: { id: task.id },
      data: { endDate: new Date("2026-07-24T12:00:00.000Z") },
    });

    await expect(confirmAssistantAction(output.proposal.id, context)).rejects.toBeInstanceOf(
      AssistantActionError
    );
    expect(
      await prisma.assistantActionProposal.findUniqueOrThrow({ where: { id: output.proposal.id } })
    ).toMatchObject({ status: "PENDING" });
  });

  it("requires schedule-edit permission", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const task = await createTask("Restricted schedule shift", "2026-07-25", "2026-07-26");
    await expect(
      createScheduleActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          operation: "SHIFT_TASKS",
          taskIds: [task.id],
          shiftDays: 1,
        },
        { organizationId: fixture.organization.id, userId: fixture.trade.user.id }
      )
    ).rejects.toBeInstanceOf(PermissionError);
  });
});
