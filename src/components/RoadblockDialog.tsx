"use client";

import { useState } from "react";
import { flagRoadblock, resolveRoadblock } from "@/app/actions/tasks";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { RoadblockBadge } from "@/components/RoadblockBadge";
import { ROADBLOCK_TYPE_LABELS } from "@/lib/utils";
import type { RoadblockType } from "@prisma/client";

const ROADBLOCK_TYPES: RoadblockType[] = ["CHANGE_ORDER", "INSPECTION", "LABOR", "MATERIAL", "WEATHER", "OTHER"];

type Props = {
  taskId: string;
  isRoadblock: boolean;
  roadblockNote: string | null;
  roadblockStatus: "OPEN" | "RESOLVED" | null;
  canResolve: boolean;
};

export function RoadblockDialog({ taskId, isRoadblock, roadblockNote, roadblockStatus, canResolve }: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [type, setType] = useState<RoadblockType>("OTHER");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleFlag() {
    setError(null);
    setLoading(true);
    const result = await flagRoadblock({ taskId, roadblockNote: note, roadblockType: type });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setNote("");
  }

  async function handleResolve() {
    setError(null);
    setLoading(true);
    const result = await resolveRoadblock({ taskId });
    setLoading(false);
    if (!result.success) setError(result.error);
  }

  if (isRoadblock && roadblockStatus) {
    return (
      <div className="max-w-[220px]">
        <div className="flex items-start gap-2">
          <div>
            <RoadblockBadge status={roadblockStatus} />
            {roadblockNote && <p className="text-xs text-muted mt-1">{roadblockNote}</p>}
          </div>
          {roadblockStatus === "OPEN" && canResolve && (
            <Button variant="text" className="text-xs whitespace-nowrap" onClick={handleResolve} disabled={loading}>
              {loading ? "Resolving…" : "Resolve"}
            </Button>
          )}
        </div>
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="text" className="text-xs text-muted" onClick={() => setOpen(true)}>
        Flag roadblock
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-56">
      <select
        aria-label="Roadblock type"
        value={type}
        onChange={(e) => setType(e.target.value as RoadblockType)}
        className="text-xs rounded-md border border-hairline px-2 py-1.5 focus:outline-none focus:border-ink"
      >
        {ROADBLOCK_TYPES.map((t) => (
          <option key={t} value={t}>
            {ROADBLOCK_TYPE_LABELS[t]}
          </option>
        ))}
      </select>
      <textarea
        aria-label="Roadblock details"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="What's blocking this task?"
        rows={2}
        maxLength={500}
        className="text-xs rounded-md border border-hairline px-2 py-1.5 focus:outline-none focus:border-ink resize-none"
      />
      <div className="flex gap-2">
        <Button variant="secondary" className="h-7 px-2 text-xs" onClick={handleFlag} disabled={loading}>
          {loading ? "Flagging…" : "Flag"}
        </Button>
        <Button variant="text" className="h-7 px-2 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
