import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AssistantActionKind } from "@prisma/client";
import {
  cancelAssistantAction,
  confirmAssistantAction,
  createBaselineActionProposal,
  createProjectControlActionProposal,
  createRoadblockActionProposal,
  createScheduleActionProposal,
  createScheduleImpactActionProposal,
  createTaskActionProposal,
  createTaskProgressActionProposal,
  createWeeklyCommitmentActionProposal,
} from "@/lib/assistant-actions";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

const ACTION_KINDS: AssistantActionKind[] = [
  "ROADBLOCK_CHANGE",
  "TASK_CHANGE",
  "TASK_PROGRESS_CHANGE",
  "WEEKLY_COMMITMENT_CHANGE",
  "SCHEDULE_IMPACT_CHANGE",
  "BASELINE_CHANGE",
  "SCHEDULE_CHANGE",
  "PROJECT_CONTROL_CHANGE",
];

describe("Agent cancellation matrix", () => {
  let fixture: Fixture;
  let conversationId: string;
  let taskId: string;

  beforeAll(async () => {
    fixture = await createFixture();
    conversationId = (
      await prisma.assistantConversation.create({
        data: {
          organizationId: fixture.organization.id,
          projectId: fixture.project.id,
          createdById: fixture.pm.user.id,
          title: "Cancellation matrix",
        },
      })
    ).id;
    taskId = (
      await prisma.task.create({
        data: {
          projectId: fixture.project.id,
          name: "Cancellation matrix task",
          assignedToId: fixture.pm.member.id,
          startDate: new Date("2026-05-04T12:00:00.000Z"),
          endDate: new Date("2026-05-08T12:00:00.000Z"),
        },
      })
    ).id;
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it.each(ACTION_KINDS)("cancels %s idempotently and cannot confirm it later", async (kind) => {
    const context = {
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
    };
    const output = kind === "ROADBLOCK_CHANGE"
      ? await createRoadblockActionProposal(
          { conversationId, taskId, note: "Cancellation matrix roadblock" },
          context
        )
      : kind === "TASK_CHANGE"
        ? await createTaskActionProposal(
            {
              conversationId,
              projectId: fixture.project.id,
              operation: "CREATE",
              name: `Cancelled task ${Date.now()}`,
              startDate: "2026-05-11",
              endDate: "2026-05-12",
            },
            context
          )
        : kind === "TASK_PROGRESS_CHANGE"
          ? await createTaskProgressActionProposal(
              { conversationId, projectId: fixture.project.id, taskId, progress: 50 },
              context
            )
          : kind === "WEEKLY_COMMITMENT_CHANGE"
            ? await createWeeklyCommitmentActionProposal(
                {
                  conversationId,
                  projectId: fixture.project.id,
                  operation: "CREATE",
                  taskId,
                  weekStartDate: "2026-08-03",
                },
                context
              )
            : kind === "SCHEDULE_IMPACT_CHANGE"
              ? await createScheduleImpactActionProposal(
                  {
                    conversationId,
                    projectId: fixture.project.id,
                    operation: "CREATE",
                    taskId,
                    description: "Cancellation matrix impact",
                  },
                  context
                )
              : kind === "BASELINE_CHANGE"
                ? await createBaselineActionProposal(
                    {
                      conversationId,
                      projectId: fixture.project.id,
                      operation: "CREATE",
                      name: `Cancelled baseline ${Date.now()}`,
                    },
                    context
                  )
                : kind === "SCHEDULE_CHANGE"
                  ? await createScheduleActionProposal(
                      {
                        conversationId,
                        projectId: fixture.project.id,
                        operation: "SHIFT_TASKS",
                        taskIds: [taskId],
                        shiftDays: 1,
                      },
                      context
                    )
                  : await createProjectControlActionProposal(
                      {
                        conversationId,
                        projectId: fixture.project.id,
                        entity: "RFI",
                        operation: "CREATE",
                        question: `Cancelled RFI ${Date.now()}`,
                      },
                      context
                    );
    if (output.kind !== "action-proposal") throw new Error(`Expected a ${kind} proposal`);
    const proposalId = output.proposal.id;

    await expect(cancelAssistantAction(proposalId, context)).resolves.toMatchObject({
      id: proposalId,
      status: "CANCELLED",
    });
    await expect(cancelAssistantAction(proposalId, context)).resolves.toMatchObject({
      id: proposalId,
      status: "CANCELLED",
    });
    await expect(confirmAssistantAction(proposalId, context)).rejects.toMatchObject({ status: 409 });
  });
});
