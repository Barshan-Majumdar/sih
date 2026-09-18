"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { ok, fail, ActionResult } from "./schemas";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || `org-${Date.now()}`
  );
}

export async function createOrganization(formData: FormData): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    const user = await requireUser();
    const name = formData.get("name")?.toString().trim();
    if (!name) return fail("Organization name is required");

    const slug = `${slugify(name)}-${Date.now().toString(36)}`;

    const org = await prisma.organization.create({
      data: {
        name,
        slug,
        members: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
    });

    return ok({ id: org.id, name: org.name });
  } catch (error) {
    return fail(error);
  }
}
