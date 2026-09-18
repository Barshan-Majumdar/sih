import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireProjectMember } from "@/lib/permissions";
import { requireActiveOrganization, requireUser } from "@/lib/session";

const createConversationSchema = z.object({
  projectId: z.string().min(1).nullable().optional(),
});

export async function GET() {
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();

  const [projects, conversations] = await Promise.all([
    prisma.project.findMany({
      where: {
        organizationId,
        isArchived: false,
        members: { some: { userId: user.id } },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.assistantConversation.findMany({
      where: {
        organizationId,
        createdById: user.id,
        OR: [{ projectId: null }, { project: { members: { some: { userId: user.id } } } }],
      },
      include: { _count: { select: { messages: true } } },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  return Response.json({
    projects,
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      projectId: conversation.projectId,
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: conversation._count.messages,
    })),
  });
}

export async function POST(request: Request) {
  const parsed = createConversationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Choose a valid project." }, { status: 400 });
  }

  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const projectId = parsed.data.projectId ?? null;

  if (projectId) {
    const project = await prisma.project.findFirst({ where: { id: projectId, organizationId } });
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    await requireProjectMember(user.id, projectId);
  }

  const conversation = await prisma.assistantConversation.create({
    data: {
      organizationId,
      projectId,
      createdById: user.id,
    },
  });

  return Response.json(
    {
      id: conversation.id,
      title: conversation.title,
      projectId: conversation.projectId,
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: 0,
    },
    { status: 201 }
  );
}
