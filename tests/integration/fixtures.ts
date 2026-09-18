import { prisma } from "@/lib/prisma";

/**
 * Creates a fully isolated organization + project + one member per role,
 * with a unique random suffix so parallel/repeat test runs never collide
 * with each other or with the app's demo seed data. Callers must call
 * `cleanupFixture` in an `afterAll` to remove everything (cascades handle
 * the rest once the organization is deleted).
 */
export async function createFixture() {
  const suffix = Math.random().toString(36).slice(2, 10);

  const organization = await prisma.organization.create({
    data: { name: `Test Org ${suffix}`, slug: `test-org-${suffix}` },
  });

  const project = await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: `Test Project ${suffix}`,
      startDate: new Date("2026-01-01"),
      endDate: new Date("2026-06-30"),
    },
  });

  async function createUserWithRole(role: "PROJECT_MANAGER" | "SCHEDULER" | "SUPERINTENDENT" | "TRADE") {
    const user = await prisma.user.create({
      data: { name: `${role} ${suffix}`, email: `${role.toLowerCase()}-${suffix}@test.local`, emailVerified: true },
    });
    const member = await prisma.projectMember.create({
      data: { projectId: project.id, userId: user.id, role },
    });
    await prisma.member.create({
      data: { organizationId: organization.id, userId: user.id },
    });
    return { user, member };
  }

  const pm = await createUserWithRole("PROJECT_MANAGER");
  const scheduler = await createUserWithRole("SCHEDULER");
  const superintendent = await createUserWithRole("SUPERINTENDENT");
  const trade = await createUserWithRole("TRADE");

  return { organization, project, pm, scheduler, superintendent, trade };
}

export type Fixture = Awaited<ReturnType<typeof createFixture>>;

/** Deleting the organization cascades to project -> tasks/members/etc. */
export async function cleanupFixture(fixture: Fixture) {
  await prisma.organization.delete({ where: { id: fixture.organization.id } }).catch(() => {});
  await prisma.user.deleteMany({
    where: { id: { in: [fixture.pm.user.id, fixture.scheduler.user.id, fixture.superintendent.user.id, fixture.trade.user.id] } },
  });
}
