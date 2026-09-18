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
      <table className="w-full min-w-[620px] text-sm">
        <thead>
          <tr className="border-b border-hairline text-left">
            <th className="app-table-heading py-2">Name</th>
            <th className="app-table-heading py-2">Email</th>
            <th className="app-table-heading py-2">Role</th>
            {canManage && <th className="app-table-heading py-2 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => (
            <tr key={member.id} className="app-table-row border-b border-hairline-soft last:border-b-0">
              <td className="py-3">{member.user.name}</td>
              <td className="py-3 text-muted">{member.user.email}</td>
              <td className="py-3">{PROJECT_ROLE_LABELS[member.role]}</td>
              {canManage && (
                <td className="py-3 text-right">
                  <Button
                    variant="text"
                    className="text-error"
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
