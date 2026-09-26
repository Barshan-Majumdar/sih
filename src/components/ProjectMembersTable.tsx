"use client";

import { useState, useTransition } from "react";
import { removeMember } from "@/app/actions/members";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { PROJECT_ROLE_LABELS } from "@/lib/utils";
import type { ProjectRole } from "@prisma/client";

type MemberRow = {
  id: string;
  role: ProjectRole;
  user: { id: string; name: string; email: string };
};

export function ProjectMembersTable({
  projectId,
  members,
  canManage,
}: {
  projectId: string;
  members: MemberRow[];
  canManage: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [removingId, setRemovingId] = useState<string | null>(null);

  function handleRemove(memberId: string) {
    setError(null);
    setRemovingId(memberId);
    startTransition(async () => {
      const result = await removeMember({ projectId, memberId });
      if (!result.success) setError(result.error);
      setRemovingId(null);
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-sm text-left">
        <thead>
          <tr className="border-b border-hairline bg-surface-soft/80 text-[11px] font-bold uppercase tracking-wider text-muted">
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Role</th>
            {canManage && <th className="px-4 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {members.map((member) => (
            <tr key={member.id} className="hover:bg-surface-soft/40 transition-colors">
              <td className="px-4 py-3.5 font-semibold tracking-tight text-ink">{member.user.name}</td>
              <td className="px-4 py-3.5 text-xs text-muted font-mono">{member.user.email}</td>
              <td className="px-4 py-3.5">
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-tight bg-surface-soft border border-hairline text-ink">
                  {PROJECT_ROLE_LABELS[member.role]}
                </span>
              </td>
              {canManage && (
                <td className="px-4 py-3.5 text-right">
                  <Button
                    variant="danger"
                    className="h-7 px-2.5 text-xs font-semibold"
                    disabled={pending && removingId === member.id}
                    onClick={() => handleRemove(member.id)}
                  >
                    {pending && removingId === member.id ? "Removing…" : "Remove"}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
