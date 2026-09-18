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
    <div className="border border-hairline rounded-lg p-5 bg-surface-soft">
      <h3 className="app-card-title">{firstInvite ? "Bring your team into the project" : "Invite a teammate"}</h3>
      <p className="app-card-description mb-3">
        {firstInvite
          ? "Choose the right project role and share a secure invitation link."
          : "Create a role-specific invitation link for another project member."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Project role"
          value={role}
          onChange={(e) => setRole(e.target.value as ProjectRole)}
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        >
          {INVITABLE_ROLES.map((r) => (
            <option key={r} value={r}>
              {PROJECT_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" onClick={handleGenerate} disabled={loading}>
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
            className="h-10 flex-1 min-w-0 rounded-md border border-hairline bg-canvas px-3 text-sm text-body"
          />
          <Button type="button" variant="secondary" onClick={handleCopy}>
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      )}
    </div>
  );
}
