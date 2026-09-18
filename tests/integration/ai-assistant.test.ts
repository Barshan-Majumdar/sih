import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { answerAssistantQuestion, AssistantNotConfiguredError } from "@/lib/ai-assistant";
import { env } from "@/lib/env";
import { createFixture, cleanupFixture, type Fixture } from "./fixtures";

const hasApiKey = Boolean(env.OPENROUTER_API_KEY);
const live = hasApiKey ? it : it.skip;

describe("Global Agent (org-wide context + NLP)", () => {
  let fixture: Fixture;
  let secondProjectId: string;

  beforeAll(async () => {
    fixture = await createFixture();

    const roadblockTask = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Install curtain wall",
        assignedToId: fixture.trade.member.id,
        startDate: new Date("2026-03-01"),
        endDate: new Date("2026-03-10"),
        isRoadblock: true,
        roadblockStatus: "OPEN",
        roadblockType: "MATERIAL",
        roadblockNote: "Steel delivery delayed — blocking facade work",
        roadblockOwnerId: fixture.superintendent.member.id,
        roadblockDueDate: new Date("2026-03-05"),
      },
    });
    expect(roadblockTask.isRoadblock).toBe(true);

    const secondProject = await prisma.project.create({
      data: {
        organizationId: fixture.organization.id,
        name: `Healthy Tower ${fixture.organization.slug}`,
        startDate: new Date("2026-02-01"),
        endDate: new Date("2026-08-31"),
      },
    });
    secondProjectId = secondProject.id;
    await prisma.projectMember.createMany({
      data: [
        { projectId: secondProjectId, userId: fixture.pm.user.id, role: "PROJECT_MANAGER" },
        { projectId: secondProjectId, userId: fixture.trade.user.id, role: "TRADE" },
      ],
    });
    const secondTrade = await prisma.projectMember.findUniqueOrThrow({
      where: { projectId_userId: { projectId: secondProjectId, userId: fixture.trade.user.id } },
    });

    await prisma.task.create({
      data: {
        projectId: secondProjectId,
        name: "Foundation complete",
        assignedToId: secondTrade.id,
        startDate: new Date("2026-02-01"),
        endDate: new Date("2026-02-15"),
        status: "DONE",
      },
    });
  });

  afterAll(async () => {
    if (!fixture) return;
    await prisma.project.deleteMany({ where: { id: secondProjectId } }).catch(() => {});
    await cleanupFixture(fixture);
  });

  it("throws when OpenRouter is not configured", async () => {
    if (hasApiKey) return;
    await expect(
      answerAssistantQuestion(fixture.organization.id, "Hello?", { userId: fixture.pm.user.id })
    ).rejects.toBeInstanceOf(
      AssistantNotConfiguredError
    );
  });

  live(
    "answers portfolio-wide questions using org data",
    async () => {
      const answer = await answerAssistantQuestion(
        fixture.organization.id,
        "Which projects have open roadblocks? List project names.",
        { userId: fixture.pm.user.id }
      );

      expect(answer.length).toBeGreaterThan(5);
      const lower = answer.toLowerCase();
      expect(lower).toMatch(/roadblock|steel|curtain|facade|delivery|project/);
      expect(lower).toMatch(new RegExp(fixture.project.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    },
    90_000
  );

  live(
    "uses detailed context when a focus project is set",
    async () => {
      const answer = await answerAssistantQuestion(
        fixture.organization.id,
        "What exactly is blocking the schedule on this project?",
        { userId: fixture.pm.user.id, focusProjectId: fixture.project.id }
      );

      const lower = answer.toLowerCase();
      expect(lower).toMatch(/steel|curtain|delivery|roadblock|facade/);
    },
    90_000
  );

  live(
    "answers general construction NLP without inventing project-specific facts",
    async () => {
      const answer = await answerAssistantQuestion(
        fixture.organization.id,
        "In lean construction, what does PPC (Percent Plan Complete) measure?",
        { userId: fixture.pm.user.id }
      );

      const lower = answer.toLowerCase();
      expect(lower).toMatch(/percent plan complete|ppc|commitment|planned/);
      expect(lower).not.toMatch(/steel delivery delayed/);
    },
    90_000
  );

  live(
    "supports multi-turn follow-up questions",
    async () => {
      const first = await answerAssistantQuestion(
        fixture.organization.id,
        "How many active projects are in my portfolio?",
        { userId: fixture.pm.user.id }
      );
      expect(first).toMatch(/2|two/i);

      const followUp = await answerAssistantQuestion(fixture.organization.id, "Which of those has open roadblocks?", {
        userId: fixture.pm.user.id,
        history: [
          { role: "user", content: "How many active projects are in my portfolio?" },
          { role: "assistant", content: first },
        ],
      });

      expect(followUp.toLowerCase()).toMatch(/roadblock|test project|curtain|steel/);
    },
    120_000
  );
});
