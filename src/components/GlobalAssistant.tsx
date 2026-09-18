"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Building2,
  FolderKanban,
  LayoutDashboard,
  PanelLeft,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { AssistantConversation } from "@/components/ai-elements/AssistantConversation";
import { AssistantPromptInput } from "@/components/ai-elements/AssistantPromptInput";
import { PdfViewerPanel } from "@/components/PdfViewer";
import type {
  AssistantAttachmentView,
  AssistantBootstrap,
  AssistantConversationDetail,
  AssistantConversationSummary,
  AssistantUIMessage,
} from "@/lib/assistant-types";
import {
  isAllowedAssistantAttachmentType,
  MAX_ASSISTANT_ATTACHMENT_BYTES,
  MAX_ASSISTANT_ATTACHMENTS,
} from "@/lib/assistant-attachments";
import {
  PDF_VIEWER_EVENT,
  type PdfViewerDocument,
  type PdfViewerRequest,
} from "@/lib/pdf-viewer";

const PORTFOLIO_SUGGESTIONS = [
  "Which projects need attention today?",
  "Where are our biggest schedule risks?",
  "Compare open roadblocks across the portfolio.",
  "What should leadership focus on this week?",
];

const PROJECT_SUGGESTIONS = [
  "Help me create my first schedule task.",
  "Help me create my first RFI.",
  "Help me upload and review a project file.",
  "Help me set up this project step by step.",
];

function fileSuggestions(fileName: string): string[] {
  return [
    `Summarize "${fileName}" for the project team.`,
    `Find possible RFIs in "${fileName}".`,
    `Extract schedule risks from "${fileName}".`,
    `Create action items from "${fileName}".`,
  ];
}

function focusProjectIdFromPath(pathname: string | null): string | null {
  const match = pathname?.match(/^\/projects\/([^/]+)/);
  const projectId = match?.[1];
  return projectId && projectId !== "new" ? projectId : null;
}

function initialTitle(prompt: string): string {
  const singleLine = prompt.replace(/\s+/g, " ").trim();
  return singleLine.length <= 54 ? singleLine : `${singleLine.slice(0, 53).trimEnd()}...`;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error ?? "Something went wrong. Please try again.");
  }
  return payload as T;
}

type ChatWorkspaceProps = {
  detail: AssistantConversationDetail;
  projectScoped: boolean;
  pendingPrompt: string | null;
  onPromptConsumed: () => void;
  draftPrompt: string | null;
  suggestions: string[];
  onSent: (prompt: string, conversationId?: string) => void;
  onUpdated: () => void;
  onRecovered: (detail: AssistantConversationDetail) => void;
};

function ChatWorkspace({
  detail,
  projectScoped,
  pendingPrompt,
  onPromptConsumed,
  draftPrompt,
  suggestions,
  onSent,
  onUpdated,
  onRecovered,
}: ChatWorkspaceProps) {
  const [input, setInput] = useState(draftPrompt ?? "");
  const [attachments, setAttachments] = useState<AssistantAttachmentView[]>([]);
  const [uploading, setUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const lastPendingPromptRef = useRef<string | null>(null);
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/assistant/chat",
        body: { conversationId: detail.conversation.id },
      }),
    [detail.conversation.id]
  );
  const { messages, sendMessage, status, error, stop } = useChat<AssistantUIMessage>({
    id: detail.conversation.id,
    messages: detail.messages,
    transport,
    onFinish: onUpdated,
  });
  // Keep a ref so async closures can read the latest status without stale captures.
  const statusRef = useRef(status);
  statusRef.current = status;
  const busy = status === "submitted" || status === "streaming";

  const uploadAttachments = useCallback(
    async (files: FileList) => {
      const availableSlots = MAX_ASSISTANT_ATTACHMENTS - attachments.length;
      if (availableSlots <= 0) return;
      const selected = Array.from(files).slice(0, availableSlots);
      const invalid = selected.find(
        (file) =>
          file.size > MAX_ASSISTANT_ATTACHMENT_BYTES ||
          !isAllowedAssistantAttachmentType(file.type)
      );
      if (invalid) {
        setAttachmentError(
          invalid.size > MAX_ASSISTANT_ATTACHMENT_BYTES
            ? `${invalid.name} is larger than 20 MB.`
            : `${invalid.name} is not a supported PDF or image.`
        );
        return;
      }

      setUploading(true);
      setAttachmentError(
        files.length > availableSlots ? "You can attach up to four files per message." : null
      );
      const results = await Promise.allSettled(
        selected.map(async (file) => {
          const formData = new FormData();
          formData.set("conversationId", detail.conversation.id);
          formData.set("file", file);
          return fetchJson<AssistantAttachmentView>("/api/assistant/attachments", {
            method: "POST",
            body: formData,
          });
        })
      );
      const uploaded = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
      const failed = results.find((result) => result.status === "rejected");
      setAttachments((current) => [...current, ...uploaded].slice(0, MAX_ASSISTANT_ATTACHMENTS));
      if (failed?.status === "rejected") {
        setAttachmentError(
          failed.reason instanceof Error ? failed.reason.message : "An attachment could not be uploaded."
        );
      }
      setUploading(false);
    },
    [attachments.length, detail.conversation.id]
  );

  const removeAttachment = useCallback(async (attachmentId: string) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
    setAttachmentError(null);
    await fetch(`/api/assistant/attachments/${attachmentId}`, { method: "DELETE" }).catch(
      () => undefined
    );
  }, []);

  const send = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || busy) return;
      const files = attachments.map((attachment) => ({
        type: "file" as const,
        filename: attachment.fileName,
        mediaType: attachment.mediaType,
        url: attachment.url,
      }));
      const sentAt = new Date().toISOString();
      onSent(trimmed, detail.conversation.id);
      setInput("");
      setAttachments([]);
      setAttachmentError(null);
      const expectedMessageCount = messages.length + 2;
      // adoptPersistedResponse is a last-resort fallback for broken/dropped
      // connections.  It must NOT interrupt an active stream.  We gate every
      // poll on the SDK status: if it is still "submitted" or "streaming" we
      // skip the check and let the live stream finish normally.
      const adoptPersistedResponse = async () => {
        // Wait a generous initial delay so a fast, healthy response completes
        // inside the stream before we ever poll.
        await new Promise((resolve) => window.setTimeout(resolve, 15_000));
        for (let attempt = 0; attempt < 20; attempt += 1) {
          // If the SDK is still actively streaming, step aside.
          const currentStatus = statusRef.current;
          if (currentStatus === "submitted" || currentStatus === "streaming") {
            await new Promise((resolve) => window.setTimeout(resolve, 5_000));
            continue;
          }
          // If the SDK finished (status === "ready" or "error"), check whether
          // a meaningful assistant message is already displayed.  If so, we
          // don't need to recover.
          if (messages.length >= expectedMessageCount) return;
          try {
            const persisted = await fetchJson<AssistantConversationDetail>(
              `/api/assistant/conversations/${detail.conversation.id}`
            );
            if (
              persisted.messages.at(-1)?.role === "assistant" &&
              persisted.messages.length >= expectedMessageCount
            ) {
              onRecovered(persisted);
              return;
            }
          } catch {
            // Retry while the provider is still completing or the connection is recovering.
          }
          await new Promise((resolve) => window.setTimeout(resolve, 5_000));
        }
      };
      void adoptPersistedResponse();
      void sendMessage({
        text: trimmed,
        files,
        metadata: { createdAt: sentAt, completedAt: sentAt, durationMs: 0 },
      });
    },
    [attachments, busy, detail.conversation.id, messages.length, onRecovered, onSent, sendMessage]
  );

  useEffect(() => {
    if (draftPrompt !== null && draftPrompt !== undefined) {
      setInput(draftPrompt);
    }
  }, [draftPrompt]);

  useEffect(() => {
    if (!pendingPrompt || status !== "ready") return;
    if (lastPendingPromptRef.current === pendingPrompt) return;
    lastPendingPromptRef.current = pendingPrompt;
    send(pendingPrompt);
    onPromptConsumed();
  }, [onPromptConsumed, pendingPrompt, send, status]);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent text-[var(--assistant-text)]">
      <AssistantConversation
        messages={messages}
        busy={busy}
        suggestions={suggestions}
        onSuggestion={send}
      />
      {error && (
        <div className="mx-auto w-full max-w-3xl px-6 pb-2 text-sm text-error" role="alert">
          {error.message}
        </div>
      )}
      <AssistantPromptInput
        value={input}
        busy={busy}
        projectScoped={projectScoped}
        attachments={attachments}
        uploading={uploading}
        attachmentError={attachmentError}
        onChange={setInput}
        onFilesSelected={(files) => void uploadAttachments(files)}
        onRemoveAttachment={(attachmentId) => void removeAttachment(attachmentId)}
        onSubmit={() => send(input)}
        onStop={() => void stop()}
      />
    </div>
  );
}

export function GlobalAssistant() {
  const pathname = usePathname();
  const focusProjectId = focusProjectIdFromPath(pathname);
  const [open, setOpen] = useState(false);
  const [bootstrap, setBootstrap] = useState<AssistantBootstrap | null>(null);
  const [scopeId, setScopeId] = useState<string | null>(null);
  const [active, setActive] = useState<AssistantConversationDetail | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [conversationQuery, setConversationQuery] = useState("");
  const [pdfDocument, setPdfDocument] = useState<PdfViewerDocument | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  // Track which conversations were pre-created but never had a message sent,
  // so we can delete them when the panel closes.
  const emptyConversationIdsRef = useRef<Set<string>>(new Set());

  /** Silently delete an empty conversation (no messages) from the DB and from the sidebar. */
  const deleteEmptyConversation = useCallback(async (conversationId: string) => {
    emptyConversationIdsRef.current.delete(conversationId);
    setBootstrap((current) =>
      current
        ? { ...current, conversations: current.conversations.filter((c) => c.id !== conversationId) }
        : current
    );
    await fetch(`/api/assistant/conversations/${conversationId}`, { method: "DELETE" }).catch(() => undefined);
  }, []);

  /** Remove all tracked empty conversations from both the DB and sidebar. */
  const pruneEmptyConversations = useCallback(() => {
    const ids = Array.from(emptyConversationIdsRef.current);
    ids.forEach((id) => {
      void deleteEmptyConversation(id);
    });
  }, [deleteEmptyConversation]);

  const loadConversation = useCallback(async (conversationId: string) => {
    setLoading(true);
    setError(null);
    try {
      const detail = await fetchJson<AssistantConversationDetail>(
        `/api/assistant/conversations/${conversationId}`
      );
      setActive(detail);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load this conversation.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWorkspace = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextBootstrap = await fetchJson<AssistantBootstrap>("/api/assistant/conversations");
      setBootstrap(nextBootstrap);
      setSuggestions(null);
      const nextScope =
        focusProjectId && nextBootstrap.projects.some((project) => project.id === focusProjectId)
          ? focusProjectId
          : null;
      setScopeId(nextScope);
      const latest = nextBootstrap.conversations.find((conversation) => conversation.projectId === nextScope);
      if (latest) {
        const detail = await fetchJson<AssistantConversationDetail>(
          `/api/assistant/conversations/${latest.id}`
        );
        setActive(detail);
      } else {
        setActive(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load Agent.");
    } finally {
      setLoading(false);
    }
  }, [focusProjectId]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const backgroundElements = Array.from(
      document.querySelectorAll<HTMLElement>(".app-shell > header, .app-shell > nav, .app-shell > main")
    );
    document.body.style.overflow = "hidden";
    backgroundElements.forEach((element) => { element.inert = true; });
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.getClientRects().length > 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element) => { element.inert = false; });
      window.removeEventListener("keydown", onKeyDown);
      const restoreFocus = restoreFocusRef.current;
      window.requestAnimationFrame(() => restoreFocus?.focus());
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (pdfDocument) setPdfDocument(null);
      else setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open, pdfDocument]);

  useEffect(() => {
    const openViewer = (event: Event) => {
      const request = (event as CustomEvent<PdfViewerRequest>).detail;
      if (request?.placement === "agent") setPdfDocument(request);
    };
    window.addEventListener(PDF_VIEWER_EVENT, openViewer);
    return () => window.removeEventListener(PDF_VIEWER_EVENT, openViewer);
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("agira:assistant-state", { detail: { open } })
    );
  }, [open]);

  useEffect(() => {
    const toggleAssistant = (event: Event) => {
      const requestedOpen = (event as CustomEvent<{ open?: boolean }>).detail?.open;
      const nextOpen = typeof requestedOpen === "boolean" ? requestedOpen : !open;
      if (!nextOpen) {
        setPdfDocument(null);
        pruneEmptyConversations();
      }
      setOpen(nextOpen);
      if (nextOpen) void loadWorkspace();
    };
    window.addEventListener("agira:toggle-assistant", toggleAssistant);
    return () => window.removeEventListener("agira:toggle-assistant", toggleAssistant);
  }, [loadWorkspace, open, pruneEmptyConversations]);

  useEffect(() => {
    const openConversation = async (event: Event) => {
      const conversationId = (event as CustomEvent<{ conversationId?: string }>).detail?.conversationId;
      if (!conversationId) return;
      setOpen(true);
      setLoading(true);
      setError(null);
      try {
        const [nextBootstrap, detail] = await Promise.all([
          fetchJson<AssistantBootstrap>("/api/assistant/conversations"),
          fetchJson<AssistantConversationDetail>(`/api/assistant/conversations/${conversationId}`),
        ]);
        setBootstrap(nextBootstrap);
        setScopeId(detail.conversation.projectId);
        setActive(detail);
        setSuggestions(null);
        setRailOpen(false);
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : "Could not open this conversation.");
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener("agira:open-assistant-conversation", openConversation);
    return () => window.removeEventListener("agira:open-assistant-conversation", openConversation);
  }, []);

  useEffect(() => {
    const openProjectFileAgent = async (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; fileName?: string }>).detail;
      if (!detail?.projectId || !detail.fileName) return;
      setOpen(true);
      setLoading(true);
      setError(null);
      setActive(null);
      try {
        const nextBootstrap = await fetchJson<AssistantBootstrap>("/api/assistant/conversations");
        if (!nextBootstrap.projects.some((project) => project.id === detail.projectId)) {
          throw new Error("This project is unavailable or you no longer have access.");
        }

        const conversation = await fetchJson<AssistantConversationSummary>(
          "/api/assistant/conversations",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: detail.projectId }),
          }
        );

        // Mark as empty until a message is sent.
        emptyConversationIdsRef.current.add(conversation.id);
        setBootstrap({
          ...nextBootstrap,
          conversations: [conversation, ...nextBootstrap.conversations],
        });
        setScopeId(detail.projectId);
        setActive({ conversation, messages: [] });
        // Auto-send a summary prompt so the conversation isn't blank.
        setPendingPrompt(`Summarize the project file "${detail.fileName}" for me.`);
        setDraftPrompt(null);
        setSuggestions(fileSuggestions(detail.fileName));
        setDraftVersion((version) => version + 1);
        setRailOpen(false);
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : "Could not open Agent.");
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener("agira:open-project-file-agent", openProjectFileAgent);
    return () =>
      window.removeEventListener("agira:open-project-file-agent", openProjectFileAgent);
  }, []);

  useEffect(() => {
    const askAboutFile = async (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; fileName?: string }>).detail;
      if (!detail?.projectId || !detail.fileName) return;
      setOpen(true);
      setLoading(true);
      setError(null);
      try {
        const nextBootstrap = await fetchJson<AssistantBootstrap>("/api/assistant/conversations");
        if (!nextBootstrap.projects.some((project) => project.id === detail.projectId)) {
          throw new Error("This project is unavailable or you no longer have access.");
        }
        setBootstrap(nextBootstrap);
        setScopeId(detail.projectId);
        setSuggestions(fileSuggestions(detail.fileName));
        const latest = nextBootstrap.conversations.find(
          (conversation) => conversation.projectId === detail.projectId
        );
        if (latest) {
          setActive(
            await fetchJson<AssistantConversationDetail>(
              `/api/assistant/conversations/${latest.id}`
            )
          );
        } else {
          const conversation = await fetchJson<AssistantConversationSummary>(
            "/api/assistant/conversations",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: detail.projectId }),
            }
          );
          setBootstrap((current) =>
            current
              ? { ...current, conversations: [conversation, ...current.conversations] }
              : current
          );
          // Mark as empty — will be pruned if closed before first message.
          emptyConversationIdsRef.current.add(conversation.id);
          setActive({ conversation, messages: [] });
        }
        // Auto-send so the user immediately gets an answer.
        setPendingPrompt(`What does "${detail.fileName}" say?`);
        setDraftVersion((version) => version + 1);
        setRailOpen(false);
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : "Could not open Agent.");
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener("agira:ask-project-file", askAboutFile);
    return () => window.removeEventListener("agira:ask-project-file", askAboutFile);
  }, []);

  useEffect(() => {
    const raiseRfiFromFile = async (event: Event) => {
      const detail = (event as CustomEvent<{
        projectId?: string;
        fileName?: string;
        action?: "RFI" | "SUBMITTAL" | "ROADBLOCK";
      }>).detail;
      if (!detail?.projectId || !detail.fileName) return;
      setOpen(true);
      setLoading(true);
      setError(null);
      try {
        const nextBootstrap = await fetchJson<AssistantBootstrap>("/api/assistant/conversations");
        if (!nextBootstrap.projects.some((project) => project.id === detail.projectId)) {
          throw new Error("This project is unavailable or you no longer have access.");
        }
        setBootstrap(nextBootstrap);
        setScopeId(detail.projectId);
        setSuggestions(fileSuggestions(detail.fileName));
        const latest = nextBootstrap.conversations.find(
          (conversation) => conversation.projectId === detail.projectId
        );
        if (latest) {
          setActive(
            await fetchJson<AssistantConversationDetail>(
              `/api/assistant/conversations/${latest.id}`
            )
          );
        } else {
          const conversation = await fetchJson<AssistantConversationSummary>(
            "/api/assistant/conversations",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: detail.projectId }),
            }
          );
          setBootstrap((current) =>
            current
              ? { ...current, conversations: [conversation, ...current.conversations] }
              : current
          );
          setActive({ conversation, messages: [] });
        }
              const draft = detail.action === "SUBMITTAL"
          ? `Create a submittal from "${detail.fileName}": `
          : detail.action === "ROADBLOCK"
            ? `Flag [task name] as a roadblock from "${detail.fileName}": `
            : `Raise an RFI from "${detail.fileName}": `;
        setDraftPrompt(draft);
        setDraftVersion((version) => version + 1);
        setRailOpen(false);
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : "Could not open Agent.");
      } finally {
        setLoading(false);
      }
    };
    window.addEventListener("agira:raise-rfi-from-file", raiseRfiFromFile);
    return () => window.removeEventListener("agira:raise-rfi-from-file", raiseRfiFromFile);
  }, []);

  const visibleConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    const conversations = bootstrap?.conversations ?? [];
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(query)
    );
  }, [bootstrap?.conversations, conversationQuery]);
  const scopeGroups = useMemo(
    () => [
      { id: null as string | null, name: "Portfolio" },
      ...(bootstrap?.projects.map((project) => ({ id: project.id, name: project.name })) ?? []),
    ],
    [bootstrap?.projects]
  );
  const selectScope = useCallback(
    (projectId: string | null) => {
      setScopeId(projectId);
      setRailOpen(false);
      setPendingPrompt(null);
      setDraftPrompt(null);
      setSuggestions(null);
      const latest = bootstrap?.conversations.find((conversation) => conversation.projectId === projectId);
      if (latest) void loadConversation(latest.id);
      else setActive(null);
    },
    [bootstrap, loadConversation]
  );


  const createConversation = useCallback(
    async (prompt?: string) => {
      setLoading(true);
      setError(null);
      setActive(null);
      try {
        const conversation = await fetchJson<AssistantConversationSummary>("/api/assistant/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: scopeId }),
        });
        // Mark as empty until the user sends a message.
        emptyConversationIdsRef.current.add(conversation.id);
        setBootstrap((current) =>
          current
            ? { ...current, conversations: [conversation, ...current.conversations] }
            : current
        );
        setActive({ conversation, messages: [] });
        setPendingPrompt(prompt ?? null);
        setSuggestions(null);
        setRailOpen(false);
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Could not start a conversation.");
      } finally {
        setLoading(false);
      }
    },
    [scopeId]
  );

  async function deleteConversation(conversationId: string) {
      if (!window.confirm("Delete this conversation? This cannot be undone.")) return;
      try {
        const response = await fetch(`/api/assistant/conversations/${conversationId}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Could not delete this conversation.");
        const remaining = bootstrap?.conversations.filter((conversation) => conversation.id !== conversationId) ?? [];
        setBootstrap((current) => (current ? { ...current, conversations: remaining } : current));
        if (active?.conversation.id === conversationId) {
          const next = remaining.find((conversation) => conversation.projectId === scopeId);
          if (next) void loadConversation(next.id);
          else setActive(null);
        }
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Could not delete this conversation.");
      }
  }

  const handleSent = useCallback((prompt: string, conversationId?: string) => {
    const targetId = conversationId ?? active?.conversation.id;
    if (targetId) {
      emptyConversationIdsRef.current.delete(targetId);
    }
    setBootstrap((current) =>
      current
        ? {
            ...current,
            conversations: current.conversations.map((conversation) =>
              conversation.id === targetId && conversation.messageCount === 0
                ? { ...conversation, title: initialTitle(prompt), messageCount: 1 }
                : conversation
            ),
          }
        : current
    );
  }, [active?.conversation.id]);

  const activeTitle =
    bootstrap?.conversations.find((conversation) => conversation.id === active?.conversation.id)?.title ??
    active?.conversation.title ??
    "New conversation";
  const activeSuggestions =
    suggestions ?? (scopeId !== null ? PROJECT_SUGGESTIONS : PORTFOLIO_SUGGESTIONS);

  const refreshSummaries = useCallback(async () => {
    try {
      const nextBootstrap = await fetchJson<AssistantBootstrap>("/api/assistant/conversations");
      setBootstrap(nextBootstrap);
    } catch {
      // The streamed conversation remains usable even if refreshing its title fails.
    }
  }, []);

  return (
    <>
      {open && (
        <div
          className="assistant-theme fixed inset-0 z-50 h-dvh min-h-0 overflow-hidden bg-[var(--assistant-overlay)] backdrop-blur-[18px] backdrop-saturate-150"
          onKeyDown={(e) => {
            if (e.key === "Escape" && !pdfDocument) {
              pruneEmptyConversations();
            }
          }}
        >
          <aside
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Agent"
            tabIndex={-1}
            className="relative flex h-full min-h-0 w-full overflow-hidden bg-transparent before:pointer-events-none before:absolute before:left-0 before:top-0 before:z-0 before:h-4 before:w-4 before:bg-[var(--assistant-rail)] before:backdrop-blur-[38px] before:backdrop-saturate-150 before:content-[''] md:grid md:grid-cols-[280px_minmax(0,1fr)] md:before:left-[280px] lg:grid-cols-[296px_minmax(0,1fr)] lg:before:left-[296px]"
          >
            <div
              className={`${railOpen ? "flex" : "hidden"} absolute inset-y-0 left-0 z-30 h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden bg-[var(--assistant-rail)] text-[var(--assistant-rail-text)] shadow-[24px_0_60px_var(--assistant-rail-shadow)] backdrop-blur-[38px] backdrop-saturate-150 md:relative md:inset-auto md:z-10 md:flex md:w-full md:shadow-none`}
            >
              <div className="shrink-0 px-3 pb-1 pt-3">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 min-w-0 flex-1 grid-cols-2 rounded-md border border-[var(--assistant-border)] bg-[var(--assistant-layer)] p-1 shadow-inner backdrop-blur-xl" aria-label="Workspace mode">
                    <button
                      type="button"
                      className="flex min-w-0 items-center justify-center gap-1.5 rounded-sm border border-[var(--assistant-border)] bg-[var(--assistant-panel)] px-2 text-xs font-semibold text-[var(--assistant-rail-text)] shadow-[0_2px_12px_var(--assistant-shadow)] backdrop-blur-xl"
                      aria-pressed="true"
                    >
                      <span>Agent</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPdfDocument(null);
                        pruneEmptyConversations();
                        setOpen(false);
                      }}
                      className="flex min-w-0 items-center justify-center gap-1.5 rounded-sm px-2 text-xs font-medium text-[var(--assistant-rail-faint)] transition-colors hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-rail-text)]"
                      aria-label="Return to dashboard"
                    >
                      <span>Dashboard</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRailOpen(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--assistant-text-faint)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-text)] md:hidden"
                    aria-label="Close project navigation"
                  >
                    <X size={16} aria-hidden />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-3 pt-3">
                <button
                  type="button"
                  onClick={() => void createConversation()}
                  aria-label="Start new conversation"
                  disabled={loading}
                  className="flex h-9 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm font-normal text-[var(--assistant-rail-body)] transition-colors hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-rail-text)] disabled:cursor-wait disabled:opacity-50"
                >
                  <Plus size={16} aria-hidden />
                  New chat
                </button>

                <label className="mt-0.5 flex h-9 items-center gap-2 rounded-md px-2.5 text-[var(--assistant-rail-faint)] transition-colors focus-within:bg-[var(--assistant-layer-hover)] focus-within:text-[var(--assistant-rail-muted)]">
                  <Search size={15} className="shrink-0" aria-hidden />
                  <span className="sr-only">Search conversations</span>
                  <input
                    value={conversationQuery}
                    onChange={(event) => setConversationQuery(event.target.value)}
                    placeholder="Search chats"
                    className="min-w-0 flex-1 bg-transparent text-sm text-[var(--assistant-rail-body)] outline-none placeholder:text-[var(--assistant-rail-faint)]"
                  />
                </label>

                <p className="mb-3 mt-6 px-2 text-sm font-medium text-[var(--assistant-rail-section)]">Projects</p>
                <nav className="space-y-5" aria-label="Project chats">
                  {scopeGroups.map((group) => {
                    const projectConversations = visibleConversations.filter(
                      (conversation) => conversation.projectId === group.id
                    );
                    const conversationCount =
                      bootstrap?.conversations.filter(
                        (conversation) => conversation.projectId === group.id
                      ).length ?? 0;
                    const GroupIcon = group.id === null ? FolderKanban : Building2;

                    return (
                      <section key={group.id ?? "portfolio"} aria-label={`${group.name} chats`}>
                        <div className="group flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => selectScope(group.id)}
                            className={`flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors ${scopeId === group.id ? "font-medium text-[var(--assistant-rail-text)]" : "font-normal text-[var(--assistant-rail-body)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-rail-text)]"}`}
                          >
                            <GroupIcon size={15} className="shrink-0 text-[var(--assistant-rail-body)]" aria-hidden />
                            <span className="truncate">{group.name}</span>
                          </button>
                          <span className="pr-2 text-[11px] tabular-nums text-[var(--assistant-rail-faint)]">
                            {conversationCount}
                          </span>
                        </div>

                        <div className="ml-3 mt-1 space-y-0.5 border-l border-[var(--assistant-border)] pl-2">
                          {projectConversations.map((conversation) => (
                            <div
                              key={conversation.id}
                              className={`group/chat flex items-center rounded-md border transition-colors ${active?.conversation.id === conversation.id ? "border-[var(--assistant-border)] bg-[var(--assistant-layer-strong)] shadow-[0_5px_18px_var(--assistant-shadow)] backdrop-blur-xl" : "border-transparent hover:bg-[var(--assistant-layer-hover)]"}`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setScopeId(conversation.projectId);
                                  void loadConversation(conversation.id);
                                  setRailOpen(false);
                                }}
                                className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-[13px] text-[var(--assistant-rail-muted)] transition-colors group-hover/chat:text-[var(--assistant-rail-body)]"
                              >
                                <span className="truncate">{conversation.title}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void deleteConversation(conversation.id)}
                                className="mr-1 hidden rounded p-1.5 text-[var(--assistant-text-faint)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-text)] group-hover/chat:block focus:block"
                                aria-label={`Delete ${conversation.title}`}
                                title="Delete chat"
                              >
                                <Trash2 size={12} aria-hidden />
                              </button>
                            </div>
                          ))}
                          {!loading && !conversationQuery && conversationCount === 0 && scopeId === group.id && (
                            <p className="px-2 py-1.5 text-[13px] text-[var(--assistant-rail-faint)]">No chats yet</p>
                          )}
                        </div>
                      </section>
                    );
                  })}
                </nav>

                {!loading && conversationQuery && visibleConversations.length === 0 && (
                  <p className="mt-5 px-2 text-[13px] text-[var(--assistant-rail-faint)]">No matching chats.</p>
                )}
              </div>
            </div>

            <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-tl-2xl bg-[var(--assistant-panel)] backdrop-blur-[38px] backdrop-saturate-150 md:z-20">
              <header className="flex h-13 shrink-0 items-center gap-3 border-b border-[var(--assistant-border)] bg-[var(--assistant-layer)] px-4 backdrop-blur-xl sm:px-5">
                <button
                  type="button"
                  onClick={() => setRailOpen(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--assistant-text-faint)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-text)] md:hidden"
                  aria-label="Open project navigation"
                >
                  <PanelLeft size={18} aria-hidden />
                </button>
                <p className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--assistant-text-strong)]">
                  {activeTitle}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setPdfDocument(null);
                    pruneEmptyConversations();
                    setOpen(false);
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--assistant-text-faint)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-text)] md:hidden"
                  aria-label="Close Agent"
                  title="Return to dashboard"
                >
                  <LayoutDashboard size={18} aria-hidden />
                </button>
              </header>

              <div className="flex min-h-0 flex-1 overflow-hidden">
                <div className={`${pdfDocument ? "hidden lg:flex lg:w-1/2" : "flex w-full"} min-h-0 min-w-0 flex-col`}>
              {error && !active ? (
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                  <div>
                    <p className="text-sm text-error" role="alert">{error}</p>
                    <button type="button" onClick={() => void loadWorkspace()} className="mt-4 text-sm font-semibold text-[var(--assistant-text)] underline underline-offset-4">
                      Try again
                    </button>
                  </div>
                </div>
              ) : loading && !active ? (
                <div className="flex flex-1 items-center justify-center text-sm text-[var(--assistant-text-faint)]">Loading conversations...</div>
              ) : active ? (
                <ChatWorkspace
                  key={active.conversation.id}
                  detail={active}
                  projectScoped={scopeId !== null}
                  pendingPrompt={pendingPrompt}
                  onPromptConsumed={() => setPendingPrompt(null)}
                  draftPrompt={draftPrompt}
                  suggestions={activeSuggestions}
                  onSent={handleSent}
                  onUpdated={refreshSummaries}
                  onRecovered={setActive}
                />
              ) : (
                <AssistantConversation
                  messages={[]}
                  busy={false}
                  suggestions={activeSuggestions}
                  onSuggestion={(suggestion) => void createConversation(suggestion)}
                />
              )}
                </div>
                {pdfDocument && (
                  <div className="h-full min-h-0 min-w-0 w-full lg:w-1/2">
                    <PdfViewerPanel
                      key={`${pdfDocument.url}:${pdfDocument.page}`}
                      document={pdfDocument}
                      onClose={() => setPdfDocument(null)}
                      variant="agent"
                    />
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
