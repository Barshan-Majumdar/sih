"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveProject, unarchiveProject } from "@/app/actions/projects";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";

export function ArchiveProjectButton({ projectId, isArchived }: { projectId: string; isArchived: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const action = isArchived ? unarchiveProject : archiveProject;
      const result = await action({ projectId });
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.push("/projects");
      router.refresh();
    });
  }

  return (
    <div className="text-right">
      <Button variant="secondary" onClick={handleClick} disabled={pending}>
        {pending ? (isArchived ? "Unarchiving…" : "Archiving…") : isArchived ? "Unarchive" : "Archive"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
