import type { UIMessage } from "ai";
import type { AssistantActionStatus } from "@prisma/client";

export type AssistantMessageMetadata = {
  createdAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
};

export type AssistantUIMessage = UIMessage<AssistantMessageMetadata>;

export type AssistantProject = {
  id: string;
  name: string;
};

export type AssistantConversationSummary = {
  id: string;
  title: string;
  projectId: string | null;
  updatedAt: string;
  messageCount: number;
};

export type AssistantBootstrap = {
  projects: AssistantProject[];
  conversations: AssistantConversationSummary[];
};

export type AssistantConversationDetail = {
  conversation: AssistantConversationSummary;
  messages: AssistantUIMessage[];
};

export type AssistantAttachmentView = {
  id: string;
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  url: string;
  extractionStatus?: "PENDING" | "PROCESSING" | "READY" | "FAILED" | "UNSUPPORTED";
  extractionError?: string | null;
};

export type AssistantActionChange = {
  field: string;
  label: string;
  before: string;
  after: string;
};

export type AssistantActionProposalView = {
  id: string;
  projectId: string;
  status: AssistantActionStatus;
  actionLabel: string;
  title: string;
  projectName: string;
  taskName: string;
  changes: AssistantActionChange[];
  warnings?: string[];
  href: string;
  hrefLabel: string;
  expiresAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  result: unknown;
};

export type AssistantActionToolOutput = {
  kind: "action-proposal";
  proposal: AssistantActionProposalView;
  sources: Array<{ label: string; href: string }>;
};
