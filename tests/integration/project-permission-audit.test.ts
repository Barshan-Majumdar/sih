import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  PermissionError,
  getProjectRole,
  requireProjectDependencyReference,
  requireProjectMember,
  requireProjectMemberReference,
  requireProjectTaskReference,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

describe("project permission audit", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it("revokes project access when organization membership is removed", async () => {
    await prisma.member.delete({
      where: {
        organizationId_userId: {
          organizationId: fixture.organization.id,
          userId: fixture.trade.user.id,
        },
      },
    });

    try {
      await expect(getProjectRole(fixture.trade.user.id, fixture.project.id)).resolves.toBeNull();
      await expect(
        requireProjectMember(fixture.trade.user.id, fixture.project.id)
      ).rejects.toBeInstanceOf(PermissionError);
      await expect(
        requireProjectMemberReference(fixture.project.id, fixture.trade.member.id)
      ).rejects.toBeInstanceOf(PermissionError);
    } finally {
      await prisma.member.create({
        data: {
          organizationId: fixture.organization.id,
          userId: fixture.trade.user.id,
        },
      });
    }
  });

  it("rejects member, task, and dependency references from another project", async () => {
    const otherProject = await prisma.project.create({
      data: {
        organizationId: fixture.organization.id,
        name: "Permission boundary project",
        startDate: new Date("2026-07-01T12:00:00.000Z"),
        endDate: new Date("2026-12-31T12:00:00.000Z"),
      },
    });
    const otherMember = await prisma.projectMember.create({
      data: {
        projectId: otherProject.id,
        userId: fixture.pm.user.id,
        role: "PROJECT_MANAGER",
      },
    });
    const [localPredecessor, localSuccessor, otherPredecessor, otherSuccessor] =
      await Promise.all([
        prisma.task.create({
          data: {
            projectId: fixture.project.id,
            name: "Local predecessor",
            startDate: new Date("2026-08-01T12:00:00.000Z"),
            endDate: new Date("2026-08-02T12:00:00.000Z"),
          },
        }),
        prisma.task.create({
          data: {
            projectId: fixture.project.id,
            name: "Local successor",
            startDate: new Date("2026-08-03T12:00:00.000Z"),
            endDate: new Date("2026-08-04T12:00:00.000Z"),
          },
        }),
        prisma.task.create({
          data: {
            projectId: otherProject.id,
            name: "Other predecessor",
            startDate: new Date("2026-08-01T12:00:00.000Z"),
            endDate: new Date("2026-08-02T12:00:00.000Z"),
          },
        }),
        prisma.task.create({
          data: {
            projectId: otherProject.id,
            name: "Other successor",
            startDate: new Date("2026-08-03T12:00:00.000Z"),
            endDate: new Date("2026-08-04T12:00:00.000Z"),
          },
        }),
      ]);
    const [localDependency, otherDependency] = await Promise.all([
      prisma.taskDependency.create({
        data: { predecessorId: localPredecessor.id, successorId: localSuccessor.id },
      }),
      prisma.taskDependency.create({
        data: { predecessorId: otherPredecessor.id, successorId: otherSuccessor.id },
      }),
    ]);

    await expect(
      requireProjectMemberReference(fixture.project.id, fixture.trade.member.id)
    ).resolves.toMatchObject({ id: fixture.trade.member.id });
    await expect(
      requireProjectTaskReference(fixture.project.id, localPredecessor.id)
    ).resolves.toMatchObject({ id: localPredecessor.id });
    await expect(
      requireProjectDependencyReference(fixture.project.id, localDependency.id)
    ).resolves.toMatchObject({ id: localDependency.id });

    await expect(
      requireProjectMemberReference(fixture.project.id, otherMember.id)
    ).rejects.toBeInstanceOf(PermissionError);
    await expect(
      requireProjectTaskReference(fixture.project.id, otherPredecessor.id)
    ).rejects.toBeInstanceOf(PermissionError);
    await expect(
      requireProjectDependencyReference(fixture.project.id, otherDependency.id)
    ).rejects.toBeInstanceOf(PermissionError);
  });
});
