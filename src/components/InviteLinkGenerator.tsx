"use client";

import { useState } from "react";
import { createInvite } from "@/app/actions/members";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { PROJECT_ROLE_LABELS } from "@/lib/utils";
import type { ProjectRole } from "@prisma/client";

const INVITABLE_ROLES: ProjectRole[] = ["TRADE", "SUPERINTENDENT", "SCHEDULER", "PROJECT_MANAGER"];

export function InviteLinkGenerator({
  projectId,
  firstInvite = false,
}: {
  projectId: string;
  firstInvite?: boolean;
}) {
  const [role, setRole] = useState<ProjectRole>("TRADE");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    setError(null);
    setCopied(false);
    setLoading(true);
    const result = await createInvite({ projectId, role });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setLink(`${window.location.origin}/invite/${result.data.token}`);
  }

  async function handleCopy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface-soft/80 p-5 shadow-card">
      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Access & permissions</p>
        <h3 className="text-sm font-semibold tracking-tight text-ink mt-0.5">{firstInvite ? "Bring your team into the project" : "Invite a teammate"}</h3>
        <p className="text-xs text-muted mt-0.5">
          {firstInvite
            ? "Choose the right project role and share a secure invitation link."
            : "Create a role-specific invitation link for another project member."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Project role"
          value={role}
          onChange={(e) => setRole(e.target.value as ProjectRole)}
          className="h-9 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all shadow-2xs"
        >
          {INVITABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {PROJECT_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <Button type="button" variant="primary" onClick={handleGenerate} disabled={loading} className="h-9 text-xs font-semibold shadow-2xs">
          {loading ? "Generating…" : "Generate invite link"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
      {link && (
        <div className="mt-4 flex items-center gap-2">
          <input
            aria-label="Invitation link"
            readOnly
            value={link}
            className="h-9 flex-1 min-w-0 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink font-mono focus:outline-none"
          />
          <Button type="button" variant="secondary" onClick={handleCopy} className="h-9 text-xs font-semibold shadow-2xs">
            {copied ? "Copied!" : "Copy Link"}
          </Button>
        </div>
      )}
    </div>
  );
}
