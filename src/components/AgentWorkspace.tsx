"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
import { ThemeToggle } from "@/components/ThemeToggle";
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
  scopeName?: string;
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
  scopeName,
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

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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

      const adoptPersistedResponse = async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 15_000));
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const currentStatus = statusRef.current;
          if (currentStatus === "submitted" || currentStatus === "streaming") {
            await new Promise((resolve) => window.setTimeout(resolve, 5_000));
            continue;
          }
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
          } catch {}
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

  const [prevDraft, setPrevDraft] = useState(draftPrompt);
  if (draftPrompt !== prevDraft) {
    setPrevDraft(draftPrompt);
    if (draftPrompt !== null && draftPrompt !== undefined) {
      setInput(draftPrompt);
    }
  }

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
        onSuggestionAction={send}
        scopeName={scopeName}
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
        onStop={stop}
      />
    </div>
  );
}

export type AgentWorkspaceProps = {
  initialProjectId?: string | null;
};

function AgentWorkspaceInner({ initialProjectId = null }: AgentWorkspaceProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlChatId = searchParams.get("chatId");
  const urlFile = searchParams.get("file");

  const [bootstrap, setBootstrap] = useState<AssistantBootstrap | null>(null);
  const [scopeId, setScopeId] = useState<string | null>(initialProjectId ?? null);
  const [active, setActive] = useState<AssistantConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conversationQuery, setConversationQuery] = useState("");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [draftPrompt, setDraftPrompt] = useState<string | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [pdfDocument, setPdfDocument] = useState<PdfViewerDocument | null>(null);

  const emptyConversationIdsRef = useRef<Set<string>>(new Set());

  // Mark body with is-agent-page to eliminate dashboard margins, body scrolling, and layout shifting
  useEffect(() => {
    document.body.classList.add("is-agent-page");
    document.body.classList.remove("has-project-rail");
    return () => {
      document.body.classList.remove("is-agent-page");
      document.body.classList.add("has-project-rail");
      try {
        const isCol = localStorage.getItem("agira_sidebar_collapsed") === "true";
        document.body.classList.toggle("sidebar-collapsed", isCol);
      } catch {}
    };
  }, []);

  // Sync scopeId when initialProjectId prop updates
  useEffect(() => {
    if (initialProjectId !== undefined) {
      setScopeId(initialProjectId);
    }
  }, [initialProjectId]);

  const pruneEmptyConversations = useCallback(() => {
    const ids = Array.from(emptyConversationIdsRef.current);
    emptyConversationIdsRef.current.clear();
    for (const id of ids) {
      fetch(`/api/assistant/conversations/${id}`, { method: "DELETE" }).catch(() => undefined);
    }
  }, []);

  const updateUrlWithChat = useCallback(
    (_nextScopeId: string | null, conversationId: string | null) => {
      const targetUrl = conversationId ? `/agent?chatId=${encodeURIComponent(conversationId)}` : "/agent";
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", targetUrl);
      }
    },
    []
  );

  const loadWorkspace = useCallback(
    async (preferredChatId?: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const nextBootstrap = await fetchJson<AssistantBootstrap>("/api/assistant/conversations");
        setBootstrap(nextBootstrap);
        setSuggestions(null);

        const targetScope =
          scopeId && nextBootstrap.projects.some((p) => p.id === scopeId)
            ? scopeId
            : null;
        setScopeId(targetScope);

        if (urlFile) {
          // Open new chat tailored for file
          const conversation = await fetchJson<AssistantConversationSummary>(
            "/api/assistant/conversations",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: targetScope }),
            }
          );
          emptyConversationIdsRef.current.add(conversation.id);
          setBootstrap((prev) =>
            prev ? { ...prev, conversations: [conversation, ...prev.conversations] } : prev
          );
          setActive({ conversation, messages: [] });
          setSuggestions(fileSuggestions(urlFile));
          setPendingPrompt(`Summarize "${urlFile}" for the project team.`);
          setDraftVersion((v) => v + 1);
          updateUrlWithChat(targetScope, conversation.id);
          return;
        }

        if (preferredChatId) {
          const detail = await fetchJson<AssistantConversationDetail>(
            `/api/assistant/conversations/${preferredChatId}`
          );
          setActive(detail);
          setScopeId(detail.conversation.projectId);
          updateUrlWithChat(detail.conversation.projectId, detail.conversation.id);
        } else {
          // By default on page entry: start a fresh new chat
          const conversation = await fetchJson<AssistantConversationSummary>(
            "/api/assistant/conversations",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId: targetScope }),
            }
          );
          emptyConversationIdsRef.current.add(conversation.id);
          setBootstrap((prev) =>
            prev ? { ...prev, conversations: [conversation, ...prev.conversations] } : prev
          );
          setActive({ conversation, messages: [] });
          updateUrlWithChat(targetScope, null);
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load Agent.");
      } finally {
        setLoading(false);
      }
    },
    [scopeId, updateUrlWithChat, urlFile]
  );

  useEffect(() => {
    void loadWorkspace(urlChatId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createConversation = useCallback(
    async (suggestion?: string) => {
      setLoading(true);
      setError(null);
      try {
        const conversation = await fetchJson<AssistantConversationSummary>(
          "/api/assistant/conversations",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ projectId: scopeId }),
          }
        );
        emptyConversationIdsRef.current.add(conversation.id);
        setBootstrap((current) =>
          current
            ? { ...current, conversations: [conversation, ...current.conversations] }
            : current
        );
        setActive({ conversation, messages: [] });
        setDraftPrompt(null);
        setSuggestions(null);
        setDraftVersion((version) => version + 1);
        setRailOpen(false);
        updateUrlWithChat(scopeId, null);

        if (suggestion) {
          setPendingPrompt(suggestion);
        }
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Could not start chat.");
      } finally {
        setLoading(false);
      }
    },
    [scopeId, updateUrlWithChat]
  );

  const loadConversation = useCallback(
    async (conversationId: string) => {
      pruneEmptyConversations();
      setLoading(true);
      setError(null);
      try {
        const detail = await fetchJson<AssistantConversationDetail>(
          `/api/assistant/conversations/${conversationId}`
        );
        setActive(detail);
        setScopeId(detail.conversation.projectId);
        setDraftPrompt(null);
        setSuggestions(null);
        setRailOpen(false);
        updateUrlWithChat(detail.conversation.projectId, detail.conversation.id);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load conversation.");
      } finally {
        setLoading(false);
      }
    },
    [pruneEmptyConversations, updateUrlWithChat]
  );

  const deleteConversation = useCallback(
    async (conversationId: string) => {
      try {
        await fetchJson<{ success: boolean }>(`/api/assistant/conversations/${conversationId}`, {
          method: "DELETE",
        });
        emptyConversationIdsRef.current.delete(conversationId);
        setBootstrap((current) =>
          current
            ? {
                ...current,
                conversations: current.conversations.filter((c) => c.id !== conversationId),
              }
            : current
        );
        if (active?.conversation.id === conversationId) {
          void createConversation();
        }
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Could not delete conversation.");
      }
    },
    [active?.conversation.id, createConversation]
  );

  const selectScope = useCallback(
    (nextScopeId: string | null) => {
      pruneEmptyConversations();
      setScopeId(nextScopeId);
      void createConversation();
      updateUrlWithChat(nextScopeId, null);
    },
    [createConversation, pruneEmptyConversations, updateUrlWithChat]
  );

  const handleReturnToDashboard = useCallback(() => {
    pruneEmptyConversations();
    if (scopeId) {
      router.push(`/dashboard/${scopeId}`);
    } else {
      router.push("/dashboard");
    }
  }, [pruneEmptyConversations, router, scopeId]);

  const handleSent = useCallback(
    (prompt: string, conversationId?: string) => {
      if (!conversationId) return;
      emptyConversationIdsRef.current.delete(conversationId);
      updateUrlWithChat(scopeId, conversationId);

      setBootstrap((current) => {
        if (!current) return current;
        return {
          ...current,
          conversations: current.conversations.map((conversation) => {
            if (conversation.id !== conversationId) return conversation;
            const isFresh =
              conversation.title === "New conversation" || conversation.messageCount === 0;
            return {
              ...conversation,
              title: isFresh ? initialTitle(prompt) : conversation.title,
              messageCount: conversation.messageCount + 1,
              updatedAt: new Date().toISOString(),
            };
          }),
        };
      });
      setActive((current) => {
        if (!current || current.conversation.id !== conversationId) return current;
        const isFresh =
          current.conversation.title === "New conversation" || current.messages.length === 0;
        return {
          ...current,
          conversation: {
            ...current.conversation,
            title: isFresh ? initialTitle(prompt) : current.conversation.title,
          },
        };
      });
    },
    [scopeId, updateUrlWithChat]
  );

  const refreshSummaries = useCallback(async () => {
    try {
      const nextBootstrap = await fetchJson<AssistantBootstrap>("/api/assistant/conversations");
      setBootstrap(nextBootstrap);
    } catch {}
  }, []);

  // Listen for PDF viewer events
  useEffect(() => {
    const openViewer = (event: Event) => {
      const request = (event as CustomEvent<PdfViewerRequest>).detail;
      if (request?.placement === "agent") setPdfDocument(request);
    };
    window.addEventListener(PDF_VIEWER_EVENT, openViewer);
    return () => window.removeEventListener(PDF_VIEWER_EVENT, openViewer);
  }, []);

  const visibleConversations = useMemo(() => {
    const query = conversationQuery.trim().toLowerCase();
    const conversations = (bootstrap?.conversations ?? []).filter(
      (conversation) => (conversation.messageCount ?? 0) > 0
    );
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      conversation.title.toLowerCase().includes(query)
    );
  }, [bootstrap?.conversations, conversationQuery]);

  const scopeGroups = useMemo(
    () => [
      { id: null as string | null, name: "Portfolio" },
      ...(bootstrap?.projects ?? []).map((project) => ({ id: project.id, name: project.name })),
    ],
    [bootstrap?.projects]
  );

  const activeScopeName = useMemo(() => {
    if (!scopeId) return "Portfolio";
    const found = bootstrap?.projects.find((project) => project.id === scopeId);
    return found ? found.name : "Project";
  }, [bootstrap?.projects, scopeId]);

  const activeTitle = active?.conversation.title || "New conversation";
  const activeSuggestions =
    suggestions ?? (scopeId !== null ? PROJECT_SUGGESTIONS : PORTFOLIO_SUGGESTIONS);

  return (
    <div className="assistant-theme flex h-dvh w-full overflow-hidden bg-[var(--assistant-overlay)] text-[var(--assistant-text)]">
      {/* Mobile Drawer Backdrop */}
      {railOpen && (
        <div
          role="presentation"
          onClick={() => setRailOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
        />
      )}

      {/* Main 2-column Dedicated Layout */}
      <div className="relative flex h-full w-full min-h-0 overflow-hidden md:grid md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[296px_minmax(0,1fr)]">
        {/* Left Rail */}
        <aside
          aria-label="Agent Chats and Projects"
          className={`${
            railOpen ? "flex" : "hidden"
          } fixed inset-y-0 left-0 z-50 h-full w-[280px] shrink-0 flex-col overflow-hidden border-r border-[var(--assistant-border)] bg-[var(--assistant-rail)] text-[var(--assistant-rail-text)] shadow-2xl md:relative md:inset-auto md:z-10 md:flex md:w-full md:shadow-none`}
        >
          {/* Rail Header / Mode Switcher */}
          <div className="shrink-0 px-3 pb-1 pt-3">
            <div className="flex items-center gap-2">
              <div
                className="grid h-9 min-w-0 flex-1 grid-cols-2 rounded-md border border-[var(--assistant-border)] bg-[var(--assistant-layer)] p-1 shadow-inner"
                aria-label="Workspace mode"
              >
                <button
                  type="button"
                  onClick={() => void createConversation()}
                  className="flex min-w-0 items-center justify-center gap-1.5 rounded-sm border border-[var(--assistant-border)] bg-[var(--assistant-panel)] px-2 text-xs font-semibold text-[var(--assistant-rail-text)] shadow-[0_2px_12px_var(--assistant-shadow)]"
                  aria-pressed="true"
                >
                  <span>Agent</span>
                </button>
                <button
                  type="button"
                  onClick={handleReturnToDashboard}
                  className="flex min-w-0 items-center justify-center gap-1.5 rounded-sm px-2 text-xs font-medium text-[var(--assistant-rail-faint)] transition-colors hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-rail-text)]"
                  aria-label="Return to dashboard"
                >
                  <span>Dashboard</span>
                </button>
              </div>

              {/* Close Rail (Mobile) */}
              <button
                type="button"
                onClick={() => setRailOpen(false)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-[var(--assistant-text-faint)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-text)] md:hidden"
                aria-label="Close navigation"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          </div>

          {/* Rail Scrollable Conversation List */}
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-3 pt-3"
            style={{ overscrollBehavior: "contain" }}
          >
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

            <label className="mt-1 flex h-9 items-center gap-2 rounded-md px-2.5 text-[var(--assistant-rail-faint)] transition-colors focus-within:bg-[var(--assistant-layer-hover)] focus-within:text-[var(--assistant-rail-muted)]">
              <Search size={15} className="shrink-0" aria-hidden />
              <span className="sr-only">Search conversations</span>
              <input
                value={conversationQuery}
                onChange={(event) => setConversationQuery(event.target.value)}
                placeholder="Search chats"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--assistant-rail-body)] outline-none placeholder:text-[var(--assistant-rail-faint)]"
              />
            </label>

            <p className="mb-3 mt-6 px-2 text-sm font-medium text-[var(--assistant-rail-section)]">
              Projects
            </p>
            <nav className="space-y-5" aria-label="Project chats">
              {scopeGroups.map((group) => {
                const projectConversations = visibleConversations.filter(
                  (conversation) => conversation.projectId === group.id
                );
                const conversationCount = projectConversations.length;
                const GroupIcon = group.id === null ? FolderKanban : Building2;

                return (
                  <section key={group.id ?? "portfolio"} aria-label={`${group.name} chats`}>
                    <div className="group flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => selectScope(group.id)}
                        className={`flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm transition-colors ${
                          scopeId === group.id
                            ? "font-medium text-[var(--assistant-rail-text)]"
                            : "font-normal text-[var(--assistant-rail-body)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-rail-text)]"
                        }`}
                      >
                        <GroupIcon
                          size={15}
                          className="shrink-0 text-[var(--assistant-rail-body)]"
                          aria-hidden
                        />
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
                          className={`group/chat flex items-center rounded-md border transition-colors ${
                            active?.conversation.id === conversation.id
                              ? "border-[var(--assistant-border)] bg-[var(--assistant-layer-strong)] shadow-[0_4px_12px_var(--assistant-shadow)]"
                              : "border-transparent hover:bg-[var(--assistant-layer-hover)]"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => void loadConversation(conversation.id)}
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
                        <p className="px-2 py-1.5 text-[13px] text-[var(--assistant-rail-faint)]">
                          No chats yet
                        </p>
                      )}
                    </div>
                  </section>
                );
              })}
            </nav>

            {!loading && conversationQuery && visibleConversations.length === 0 && (
              <p className="mt-5 px-2 text-[13px] text-[var(--assistant-rail-faint)]">
                No matching chats.
              </p>
            )}
          </div>
        </aside>

        {/* Right Main Area */}
        <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--assistant-panel)] md:z-20">
          {/* Header */}
          <header className="flex h-13 shrink-0 items-center justify-between border-b border-[var(--assistant-border)] bg-[var(--assistant-layer)] px-4 sm:px-5">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setRailOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--assistant-text-faint)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-text)] md:hidden"
                aria-label="Open project navigation"
              >
                <PanelLeft size={18} aria-hidden />
              </button>

              <div className="flex min-w-0 items-center gap-2 truncate">
                <span className="truncate text-[13px] font-semibold text-[var(--assistant-text-strong)]">
                  {activeTitle}
                </span>
                <span className="shrink-0 text-[13px] font-normal text-[var(--assistant-rail-faint)] select-none">
                  /
                </span>
                <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-[var(--assistant-rail-faint)]">
                  {scopeId ? (
                    <Building2 size={13} className="shrink-0 opacity-70" aria-hidden />
                  ) : (
                    <FolderKanban size={13} className="shrink-0 opacity-70" aria-hidden />
                  )}
                  <span className="truncate">{activeScopeName}</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                type="button"
                onClick={handleReturnToDashboard}
                className="flex items-center gap-1.5 rounded-md border border-[var(--assistant-border)] bg-[var(--assistant-layer)] px-2.5 py-1.5 text-xs font-semibold text-[var(--assistant-text-body)] shadow-2xs transition-colors hover:border-[var(--assistant-border-strong)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-text)]"
                aria-label="Return to dashboard"
                title="Return to dashboard"
              >
                <LayoutDashboard size={14} aria-hidden />
                <span className="hidden sm:inline">Dashboard</span>
              </button>
            </div>
          </header>

          {/* Chat Workspace + PDF Split Screen */}
          <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className={`${pdfDocument ? "hidden lg:flex lg:w-1/2" : "flex w-full"} min-h-0 min-w-0 flex-col`}>
              {error && !active ? (
                <div className="flex flex-1 items-center justify-center px-6 text-center">
                  <div>
                    <p className="text-sm text-error" role="alert">
                      {error}
                    </p>
                    <button
                      type="button"
                      onClick={() => void loadWorkspace()}
                      className="mt-4 text-sm font-semibold text-[var(--assistant-text)] underline underline-offset-4"
                    >
                      Try again
                    </button>
                  </div>
                </div>
              ) : loading && !active ? (
                <div className="flex flex-1 items-center justify-center text-sm text-[var(--assistant-text-faint)]">
                  Loading conversations...
                </div>
              ) : active ? (
                <ChatWorkspace
                  key={`${active.conversation.id}-${draftVersion}`}
                  detail={active}
                  projectScoped={true}
                  scopeName={activeScopeName}
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
                  scopeName={activeScopeName}
                  onSuggestionAction={(suggestion) => void createConversation(suggestion)}
                />
              )}
            </div>

            {pdfDocument && (
              <div className="h-full min-h-0 min-w-0 w-full lg:w-1/2 border-l border-[var(--assistant-border)]">
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
      </div>
    </div>
  );
}

export function AgentWorkspace(props: AgentWorkspaceProps) {
  return (
    <Suspense
      fallback={
        <div className="assistant-theme flex h-dvh w-full items-center justify-center bg-[var(--assistant-overlay)] text-sm text-[var(--assistant-text-faint)]">
          Loading Agent...
        </div>
      }
    >
      <AgentWorkspaceInner {...props} />
    </Suspense>
  );
}
