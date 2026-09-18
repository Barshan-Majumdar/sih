"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser, requireActiveOrganization } from "@/lib/session";
import { requireProjectMember } from "@/lib/permissions";
import { answerAssistantQuestion, AssistantNotConfiguredError } from "@/lib/ai-assistant";
import { ok, fail, type ActionResult } from "./schemas";

const historySchema = z.array(
  z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(4000),
  })
);

const askSchema = z.object({
  question: z.string().min(1, "Please type a question").max(1000, "Keep the question under 1000 characters"),
  focusProjectId: z.string().optional(),
  history: historySchema.max(20).optional(),
});

export async function askAssistant(input: unknown): Promise<ActionResult<string>> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    const { organizationId } = await requireActiveOrganization();

    if (parsed.data.focusProjectId) {
      const project = await prisma.project.findFirst({
        where: { id: parsed.data.focusProjectId, organizationId },
      });
      if (!project) {
        return { success: false, error: "Project not found in your organization." };
      }
      await requireProjectMember(user.id, parsed.data.focusProjectId);
    }

    const answer = await answerAssistantQuestion(organizationId, parsed.data.question, {
      userId: user.id,
      focusProjectId: parsed.data.focusProjectId,
      history: parsed.data.history,
    });
    return ok(answer);
  } catch (error) {
    if (error instanceof AssistantNotConfiguredError) {
      return { success: false, error: error.message };
    }
    return fail(error);
  }
}
