import { prisma } from "@/lib/prisma";
import {
  getAssistantProposalId,
  hydrateAssistantActionPart,
  loadAssistantProposalStates,
} from "@/lib/assistant-actions";
import { requireAssistantConversation } from "@/lib/assistant-conversations";
import { deleteStoredFile } from "@/lib/storage";
import { requireActiveOrganization, requireUser } from "@/lib/session";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  const conversation = await requireAssistantConversation(conversationId, user.id, organizationId);
  const messages = await prisma.assistantMessage.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const proposalIds = messages.flatMap((message) =>
    Array.isArray(message.parts)
      ? message.parts.map(getAssistantProposalId).filter((id): id is string => id !== null)
      : []
  );
  const proposalStates = await loadAssistantProposalStates(proposalIds, conversationId);
  const visibleMessages = messages.filter(
    (message) => !(message.role === "ASSISTANT" && message.model === "pending" && !message.content && !message.parts)
  );

  return Response.json({
    conversation: {
      id: conversation.id,
      title: conversation.title,
      projectId: conversation.projectId,
      updatedAt: conversation.updatedAt.toISOString(),
      messageCount: visibleMessages.length,
    },
    messages: visibleMessages.map((message) => ({
      id: message.id,
      role: message.role === "USER" ? "user" : "assistant",
      metadata: {
        createdAt: message.createdAt.toISOString(),
        completedAt: (message.completedAt ?? message.createdAt).toISOString(),
        durationMs: message.durationMs,
      },
      parts: Array.isArray(message.parts)
        ? message.parts.map((part) => hydrateAssistantActionPart(part, proposalStates))
        : [{ type: "text", text: message.content }],
    })),
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params;
  const user = await requireUser();
  const { organizationId } = await requireActiveOrganization();
  await requireAssistantConversation(conversationId, user.id, organizationId);
  const pendingAttachments = await prisma.assistantAttachment.findMany({
    where: { conversationId, messageId: null },
    select: { storageKey: true, searchableStorageKey: true },
  });
  await prisma.assistantAttachment.deleteMany({
    where: { conversationId, messageId: null },
  });
  await prisma.assistantConversation.delete({ where: { id: conversationId } });
  await Promise.allSettled(
    pendingAttachments.flatMap((attachment) => [
      deleteStoredFile(attachment.storageKey),
      ...(attachment.searchableStorageKey
        ? [deleteStoredFile(attachment.searchableStorageKey)]
        : []),
    ])
  );
  return new Response(null, { status: 204 });
}
