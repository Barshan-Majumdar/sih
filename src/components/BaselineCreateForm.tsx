"use client";

import { useState } from "react";
import { createBaseline } from "@/app/actions/baselines";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";

export function BaselineCreateForm({ projectId }: { projectId: string }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createBaseline({ projectId, name });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setName("");
  }

  return (
    <form onSubmit={handleSubmit} className="border border-hairline rounded-lg p-4 bg-surface-soft">
      <h3 className="app-card-title mb-3">Save a new baseline</h3>
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Baseline name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (e.g. Original Schedule, Rev 1)"
          className="h-10 flex-1 min-w-[220px] rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <Button type="submit" variant="secondary" disabled={loading || !name.trim()}>
          {loading ? "Saving…" : "Save baseline"}
        </Button>
      </div>
      <p className="text-xs text-muted-soft mt-2">
        Captures every task&apos;s current start/end dates and status so you can compare against it later.
      </p>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
