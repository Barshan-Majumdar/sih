"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ExternalLink,
  LoaderCircle,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
import type { AssistantActionProposalView } from "@/lib/assistant-types";

type ActionResponse = {
  proposal?: AssistantActionProposalView;
  error?: string;
};

export function AssistantActionProposal({ initialProposal }: { initialProposal: AssistantActionProposalView }) {
  const router = useRouter();
  const [proposal, setProposal] = useState(initialProposal);
  const [submitting, setSubmitting] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(action: "confirm" | "cancel") {
    setSubmitting(action);
    setError(null);
    try {
      const response = await fetch(`/api/assistant/actions/${proposal.id}`, {
        method: "PATCH",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await response.json().catch(() => null)) as ActionResponse | null;
      if (!response.ok || !data?.proposal) {
        throw new Error(data?.error ?? "Could not update this proposal.");
      }
      setProposal(data.proposal);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not update this proposal.");
    } finally {
      setSubmitting(null);
    }
  }

  const pending = proposal.status === "PENDING";
  const warnings = proposal.warnings ?? [];
  return (
    <section className="overflow-hidden rounded-md border border-[var(--assistant-border)] bg-[var(--assistant-layer)] shadow-sm" aria-label="Action proposal">
      <div className="border-b border-[var(--assistant-border)] bg-[var(--assistant-layer)] px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--assistant-accent)] text-[var(--assistant-on-accent)]">
            {proposal.status === "CONFIRMED" ? (
              <CheckCircle2 size={17} aria-hidden />
            ) : (
              <ShieldCheck size={17} aria-hidden />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase text-[var(--assistant-text-faint)]">
              {proposal.status === "CONFIRMED"
                ? "Change applied"
                : proposal.status === "CANCELLED"
                  ? "Proposal cancelled"
                  : proposal.status === "EXPIRED"
                    ? "Proposal expired"
                    : "Confirmation required"}
            </p>
            <h4 className="mt-0.5 text-sm font-semibold text-[var(--assistant-text-strong)]">{proposal.title}</h4>
            <p className="mt-1 text-xs text-[var(--assistant-text-faint)]">{proposal.projectName}</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-[var(--assistant-border)] px-4">
        {proposal.changes.map((change) => (
          <div
            key={change.field}
            className="grid gap-1.5 py-3 sm:grid-cols-[92px_1fr_18px_1fr] sm:items-center"
          >
            <span className="text-[11px] font-semibold text-[var(--assistant-text-faint)]">{change.label}</span>
            <span className="min-w-0 break-words text-xs text-[var(--assistant-text-muted)]">{change.before}</span>
            <ArrowRight size={13} className="hidden text-[var(--assistant-text-faint)] sm:block" aria-hidden />
            <span className="min-w-0 break-words text-xs font-semibold text-[var(--assistant-text-strong)]">{change.after}</span>
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <div className="border-t border-warning/25 bg-warning/8 px-4 py-3">
          <div className="flex items-start gap-2">
            <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="text-xs font-semibold text-[var(--assistant-text-strong)]">Schedule impact</p>
              <ul className="mt-1.5 space-y-1 text-xs leading-5 text-[var(--assistant-text-muted)]">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="border-t border-[var(--assistant-border)] bg-error/10 px-4 py-2.5 text-xs text-error" role="alert">
          {error}
        </p>
      )}

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--assistant-border)] px-4 py-3">
        <Link
          href={proposal.href}
          onClick={(event) => {
            window.dispatchEvent(
              new CustomEvent("agira:toggle-assistant", { detail: { open: false } })
            );
            const destination = new URL(proposal.href, window.location.href);
            const currentLocation = `${window.location.pathname}${window.location.search}`;
            if (`${destination.pathname}${destination.search}` === currentLocation) {
              event.preventDefault();
              router.refresh();
            }
          }}
          className="inline-flex h-8 items-center gap-1.5 text-xs font-medium text-[var(--assistant-text-muted)] hover:text-[var(--assistant-text)]"
        >
          {proposal.hrefLabel}
          <ExternalLink size={12} aria-hidden />
        </Link>
        {pending && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void submit("cancel")}
              disabled={submitting !== null}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--assistant-border)] px-3 text-xs font-semibold text-[var(--assistant-text-muted)] hover:bg-[var(--assistant-layer-hover)] hover:text-[var(--assistant-text)] disabled:opacity-50"
            >
              {submitting === "cancel" ? (
                <LoaderCircle size={13} className="animate-spin" aria-hidden />
              ) : (
                <X size={13} aria-hidden />
              )}
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submit("confirm")}
              disabled={submitting !== null}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-[var(--assistant-accent)] px-3 text-xs font-semibold text-[var(--assistant-on-accent)] transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              {submitting === "confirm" ? (
                <LoaderCircle size={13} className="animate-spin" aria-hidden />
              ) : (
                <Check size={13} aria-hidden />
              )}
              Confirm change
            </button>
          </div>
        )}
      </footer>
    </section>
  );
}
