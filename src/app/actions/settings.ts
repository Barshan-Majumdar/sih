"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ok, fail, type ActionResult } from "./schemas";

const setEmailNotificationsSchema = z.object({ enabled: z.boolean() });

export async function setEmailNotifications(input: unknown): Promise<ActionResult<boolean>> {
  const parsed = setEmailNotificationsSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues.map((i) => i.message).join(", ") };
  }

  try {
    const user = await requireUser();
    await prisma.user.update({
      where: { id: user.id },
      data: { emailNotificationsEnabled: parsed.data.enabled },
    });
    revalidatePath("/settings");
    return ok(parsed.data.enabled);
  } catch (error) {
    return fail(error);
  }
}
