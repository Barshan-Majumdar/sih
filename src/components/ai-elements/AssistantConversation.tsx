"use client";

import { useEffect, useRef, useState } from "react";
import type { UIMessage } from "ai";
import { Check, Copy, ExternalLink, FileText, Image as ImageIcon } from "lucide-react";
import { isFileUIPart, isToolUIPart } from "ai";
import type { FileUIPart } from "ai";
import { Streamdown } from "streamdown";
import { AssistantToolResult } from "@/components/ai-elements/AssistantToolResult";
import type { AssistantUIMessage } from "@/lib/assistant-types";
import { openPdfViewer } from "@/lib/pdf-viewer";

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatMessageTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function getUIMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is Extract<(typeof message.parts)[number], { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

type AssistantConversationProps = {
  messages: AssistantUIMessage[];
  busy: boolean;
  suggestions: string[];
  onSuggestion: (suggestion: string) => void;
};

function AssistantRichText({ text, isAnimating }: { text: string; isAnimating: boolean }) {
  return (
    <Streamdown
      className="assistant-markdown"
      controls={false}
      isAnimating={isAnimating}
      lineNumbers={false}
      mode="streaming"
    >
      {text}
    </Streamdown>
  );
}

function AttachmentPreview({ part, userMessage }: { part: FileUIPart; userMessage: boolean }) {
  const isImage = part.mediaType.startsWith("image/");
  const className = `group block w-full overflow-hidden rounded-md border text-left transition-colors ${
        userMessage
          ? "border-[var(--assistant-border)] bg-[var(--assistant-layer-strong)] hover:bg-[var(--assistant-layer-hover)]"
          : "border-[var(--assistant-border)] bg-[var(--assistant-layer)] text-[var(--assistant-text-body)] hover:border-[var(--assistant-border-strong)]"
      }`;
  const content = <>
      {isImage && (
        // Authenticated project files must load directly in the browser so its session cookie is included.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={part.url} alt="" className="max-h-44 w-full object-cover" />
      )}
      <span className="flex min-w-0 items-center gap-2 px-3 py-2">
        {isImage ? (
          <ImageIcon size={15} className="shrink-0 opacity-70" aria-hidden />
        ) : (
          <FileText size={15} className="shrink-0 opacity-70" aria-hidden />
        )}
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {part.filename ?? "Project attachment"}
        </span>
        <ExternalLink size={13} className="shrink-0 opacity-55 group-hover:opacity-100" aria-hidden />
      </span>
    </>;
  if (part.mediaType === "application/pdf") {
    return (
      <button type="button" onClick={() => openPdfViewer(part.url, part.filename ?? "Project attachment", "agent")} className={className}>
        {content}
      </button>
    );
  }
  return (
    <a href={part.url} target="_blank" rel="noreferrer" className={className}>
      {content}
    </a>
  );
}

export function AssistantConversation({
  messages,
  busy,
  suggestions,
  onSuggestion,
}: AssistantConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  const copyToClipboard = async (messageId: string, content: string) => {
    if (!content.trim()) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      window.setTimeout(() => {
        setCopiedMessageId((current) => (current === messageId ? null : current));
      }, 1400);
    } catch {
      setCopiedMessageId(null);
    }
  };

  useEffect(() => {
    if (!busy) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, [busy]);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: busy ? "auto" : "smooth",
    });
  }, [messages, busy]);

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8">
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full max-w-2xl flex-col justify-center py-10">
          <h3 className="font-display text-2xl text-[var(--assistant-text)]">What would you like to do?</h3>
          <p className="mt-2 max-w-md text-sm leading-6 text-[var(--assistant-text-muted)]">
            Start with an action below, or ask Agent anything about this workspace.
          </p>
          <div className="mt-7 grid gap-2 sm:grid-cols-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestion(suggestion)}
                className="min-h-14 rounded-md border border-[var(--assistant-border)] bg-[var(--assistant-layer)] px-3.5 py-3 text-left text-sm leading-5 text-[var(--assistant-text-muted)] transition-colors hover:border-[var(--assistant-border-strong)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-text)]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-9 pb-4">
          {messages.map((message, index) => {
            const text = getUIMessageText(message);
            const toolParts = message.parts.filter(isToolUIPart);
            const fileParts = message.parts.filter(isFileUIPart);
            const hasToolError = toolParts.some((part) => part.state === "output-error");
            if (!text && toolParts.length === 0 && fileParts.length === 0) return null;
            const isUser = message.role === "user";
            const isActiveAssistant = !isUser && busy && index === messages.length - 1;
            const startedAt = message.metadata?.createdAt;
            const elapsedMs = isActiveAssistant && startedAt && now > 0
              ? Math.max(0, now - new Date(startedAt).getTime())
              : message.metadata?.durationMs;
            const completedAt = isActiveAssistant
              ? null
              : message.metadata?.completedAt ?? message.metadata?.createdAt ?? null;
            return (
              <div key={message.id} className={`group/message flex ${isUser ? "justify-end" : "justify-start"}`}>
                <div className={`relative flex min-w-0 flex-col ${isUser ? "max-w-[82%] items-end" : "w-full items-start"}`}>
                  <div
                    data-message-role={isUser ? "user" : "assistant"}
                    className={
                      isUser
                        ? "max-w-full whitespace-pre-wrap rounded-lg border border-[var(--assistant-border)] bg-[var(--assistant-layer-strong)] px-4 py-3 text-sm leading-6 text-[var(--assistant-text-strong)] shadow-sm"
                        : "w-full space-y-3 pt-0.5 text-[15px] leading-7 text-[var(--assistant-text-body)]"
                    }
                  >
                    {!isUser && elapsedMs !== null && elapsedMs !== undefined && (
                      <div className="mb-4 border-b border-[var(--assistant-border)] pb-2 text-xs leading-5 text-[var(--assistant-text-muted)]">
                        {isActiveAssistant ? "Working" : "Worked"} for {formatDuration(elapsedMs)}
                      </div>
                    )}
                    {!isUser && text && !isActiveAssistant ? (
                      <div className="mb-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => void copyToClipboard(message.id, text)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--assistant-border)] bg-[var(--assistant-layer)] px-2.5 py-1 text-[11px] font-medium text-[var(--assistant-text-muted)] transition-colors hover:border-[var(--assistant-border-strong)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-text)]"
                          aria-label="Copy answer"
                        >
                          {copiedMessageId === message.id ? <Check size={12} aria-hidden /> : <Copy size={12} aria-hidden />}
                          {copiedMessageId === message.id ? "Copied" : "Copy"}
                        </button>
                      </div>
                    ) : null}
                    {fileParts.length > 0 && (
                      <div className="grid gap-2">
                        {fileParts.map((part) => (
                          <AttachmentPreview
                            key={`${part.url}:${part.filename ?? "file"}`}
                            part={part}
                            userMessage={isUser}
                          />
                        ))}
                      </div>
                    )}
                    {toolParts.map((part) => (
                      <AssistantToolResult key={part.toolCallId} part={part} />
                    ))}
                    {text &&
                      !hasToolError &&
                      (isUser ? (
                        <div>{text}</div>
                      ) : (
                        <AssistantRichText text={text} isAnimating={isActiveAssistant} />
                      ))}
                  </div>
                  {completedAt && (
                    <time
                      dateTime={completedAt}
                      title={new Date(completedAt).toLocaleString()}
                      className={`pointer-events-none absolute top-full mt-1 whitespace-nowrap text-[11px] leading-4 text-[var(--assistant-text-faint)] opacity-0 transition-opacity group-hover/message:opacity-100 ${isUser ? "right-0" : "left-0"}`}
                    >
                      {formatMessageTime(completedAt)}
                    </time>
                  )}
                </div>
              </div>
            );
          })}
          {busy && messages.at(-1)?.role === "user" && (
            <div className="text-[var(--assistant-text-faint)]">
              <div>
                <p className="mb-2 text-xs leading-5 text-[var(--assistant-text-muted)]">
                  Working for {formatDuration(Math.max(0, now - new Date(messages.at(-1)?.metadata?.createdAt ?? new Date().toISOString()).getTime()))}
                </p>
                <span className="flex gap-1" aria-label="Agent is thinking">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--assistant-text-faint)]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--assistant-text-faint)] [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--assistant-text-faint)] [animation-delay:300ms]" />
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
