import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { PM_EMAIL, signIn } from "./helpers";

test("a new project exposes a real setup checklist and useful empty states", async ({ page }) => {
  const prisma = new PrismaClient();
  const projectName = `E2E Onboarding ${Date.now()}`;
  let projectId: string | null = null;

  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: PM_EMAIL } });
    const organizationMember = await prisma.member.findFirstOrThrow({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    });
    const project = await prisma.project.create({
      data: {
        organizationId: organizationMember.organizationId,
        name: projectName,
        startDate: new Date("2026-07-20T00:00:00.000Z"),
        endDate: new Date("2026-09-30T00:00:00.000Z"),
        members: { create: { userId: user.id, role: "PROJECT_MANAGER" } },
      },
    });
    projectId = project.id;

    await signIn(page, PM_EMAIL);
    await page.goto(`/projects/${projectId}`);

    await expect(page.getByRole("heading", { name: "Project setup" })).toBeVisible();
    await expect(page.getByText("1 of 5 complete")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Project setup progress" })).toHaveAttribute(
      "aria-valuenow",
      "1"
    );
    await expect(page.getByText("Build the first schedule")).toBeVisible();

    await page.getByRole("button", { name: /Ask Agent/ }).click();
    const agent = page.getByRole("dialog", { name: "Agent" });
    await expect(agent.getByRole("button", { name: "Help me create my first schedule task." })).toBeVisible();
    await expect(agent.getByRole("button", { name: "Help me create my first RFI." })).toBeVisible();
    await expect(agent.getByRole("button", { name: "Help me upload and review a project file." })).toBeVisible();
    await expect(agent.getByRole("button", { name: "Help me set up this project step by step." })).toBeVisible();
    await agent.getByRole("button", { name: "Return to dashboard" }).click();

    await page.getByRole("link", { name: /Add a project file/ }).click();
    await expect(page.getByText("Add the first project file")).toBeVisible();
    await expect(page.getByRole("button", { name: "Upload first file" })).toBeVisible();

    await page.goto(`/projects/${projectId}/members`);
    await expect(page.getByRole("heading", { name: "Bring your team into the project" })).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/projects/${projectId}`);
    await expect(page.getByRole("heading", { name: "Project setup" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ask Agent/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  } finally {
    if (projectId) await prisma.project.deleteMany({ where: { id: projectId } });
    await prisma.$disconnect();
  }
});
