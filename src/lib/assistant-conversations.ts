import { prisma } from "@/lib/prisma";
import { requireOrganizationMember, requireProjectMember } from "@/lib/permissions";

export class AssistantAccessError extends Error {}

export async function requireAssistantConversation(
  conversationId: string,
  userId: string,
  organizationId: string
) {
  const orgMembership = await requireOrganizationMember(userId, organizationId);
  const isOrgAdminOrOwner = orgMembership.role === "owner" || orgMembership.role === "admin";

  const conversation = await prisma.assistantConversation.findFirst({
    where: {
      id: conversationId,
      organizationId,
      ...(isOrgAdminOrOwner
        ? {}
        : {
            OR: [
              { createdById: userId },
              { project: { members: { some: { userId } } } },
            ],
          }),
    },
    include: {
      project: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
  });

  if (!conversation) {
    throw new AssistantAccessError("Conversation not found.");
  }

  if (conversation.projectId && !isOrgAdminOrOwner) {
    await requireProjectMember(userId, conversation.projectId);
  }

  return conversation;
}

export function makeConversationTitle(question: string): string {
  const singleLine = question.replace(/\s+/g, " ").trim();
  if (singleLine.length <= 54) return singleLine;
  return `${singleLine.slice(0, 53).trimEnd()}...`;
}
