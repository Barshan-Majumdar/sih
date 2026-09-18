"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/actions/members";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";

export function AcceptInviteButton({ token, projectId }: { token: string; projectId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setError(null);
    setLoading(true);
    try {
      const result = await acceptInvite({ token });
      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
      }
      router.push(`/projects/${projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join project");
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={handleAccept} disabled={loading} className="w-full">
        {loading ? "Joining…" : "Accept & Join Project"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
