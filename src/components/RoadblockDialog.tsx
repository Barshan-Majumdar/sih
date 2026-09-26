"use client";

import { useState } from "react";
import { flagRoadblock, resolveRoadblock } from "@/app/actions/tasks";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { RoadblockBadge } from "@/components/RoadblockBadge";
import { ROADBLOCK_TYPE_LABELS } from "@/lib/utils";
import type { RoadblockType } from "@prisma/client";
import { AlertTriangle, CheckCircle2, Flag, X } from "lucide-react";

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
      <div className="max-w-[240px]">
        <div className="flex items-start gap-2">
          <div>
            <RoadblockBadge status={roadblockStatus} />
            {roadblockNote && <p className="text-xs text-muted mt-1 leading-snug">{roadblockNote}</p>}
          </div>
          {roadblockStatus === "OPEN" && canResolve && (
            <Button
              variant="secondary"
              className="h-6 px-2 text-[11px] font-medium whitespace-nowrap gap-1 border-success/30 text-success hover:bg-success/10"
              onClick={handleResolve}
              disabled={loading}
            >
              <CheckCircle2 className="h-3 w-3" />
              <span>{loading ? "…" : "Resolve"}</span>
            </Button>
          )}
        </div>
        <ErrorText>{error}</ErrorText>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-amber-500 transition-colors group"
      >
        <Flag className="h-3 w-3 text-muted group-hover:text-amber-500 transition-colors" />
        <span>Flag constraint</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-64 rounded-xl border border-hairline bg-surface-card p-3 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink flex items-center gap-1">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Flag Roadblock
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-muted hover:text-ink text-xs"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <select
        aria-label="Roadblock type"
        value={type}
        onChange={(e) => setType(e.target.value as RoadblockType)}
        className="text-xs rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
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
        placeholder="What is blocking this activity?"
        rows={2}
        maxLength={500}
        className="text-xs rounded-lg border border-hairline bg-canvas px-2.5 py-1.5 text-ink focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none placeholder:text-muted"
      />

      <div className="flex gap-2 justify-end mt-1">
        <Button variant="secondary" className="h-7 px-2.5 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button
          variant="primary"
          className="h-7 px-2.5 text-xs bg-amber-600 hover:bg-amber-700 text-white border-transparent"
          onClick={handleFlag}
          disabled={loading}
        >
          {loading ? "Flagging…" : "Flag Roadblock"}
        </Button>
      </div>

      <ErrorText>{error}</ErrorText>
    </div>
  );
}
