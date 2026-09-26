"use client";

import { useState, useTransition } from "react";
import { ExternalLink } from "lucide-react";
import { openPdfViewer } from "@/lib/pdf-viewer";
import { resolveRoadblock, updateRoadblockDetails } from "@/app/actions/tasks";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { RoadblockBadge } from "@/components/RoadblockBadge";
import { formatDate, ROADBLOCK_TYPE_LABELS } from "@/lib/utils";
import type { RoadblockType, RoadblockStatus } from "@prisma/client";

const ROADBLOCK_TYPES: RoadblockType[] = ["CHANGE_ORDER", "INSPECTION", "LABOR", "MATERIAL", "WEATHER", "OTHER"];

export type RoadblockRow = {
  id: string;
  name: string;
  roadblockNote: string | null;
  roadblockStatus: RoadblockStatus | null;
  roadblockType: RoadblockType | null;
  roadblockOwnerId: string | null;
  roadblockDueDate: Date | null;
  roadblockAttachment: { fileName: string; fileUrl: string } | null;
  roadblockPageNumber: number | null;
  roadblockCitationExcerpt: string | null;
  raisedByName: string;
  assignedToUserId: string | null;
};

export type MemberOption = { id: string; name: string };

export function RoadblockLogTable({
  roadblocks,
  members,
  canManage,
  currentUserId,
}: {
  roadblocks: RoadblockRow[];
  members: MemberOption[];
  canManage: boolean;
  currentUserId: string;
}) {
  if (roadblocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-hairline bg-surface-soft/40 px-6 py-12 text-center">
        <p className="text-sm font-semibold tracking-tight text-ink">No roadblocks match this filter</p>
        <p className="mt-1 text-xs text-muted">Active and resolved roadblocks will appear here.</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-hairline bg-canvas shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm text-left">
          <thead>
            <tr className="border-b border-hairline bg-surface-soft/80 text-[11px] font-bold uppercase tracking-wider text-muted">
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Raised by</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {roadblocks.map((r) => (
              <RoadblockRowView key={r.id} roadblock={r} members={members} canManage={canManage} currentUserId={currentUserId} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RoadblockRowView({
  roadblock,
  members,
  canManage,
  currentUserId,
}: {
  roadblock: RoadblockRow;
  members: MemberOption[];
  canManage: boolean;
  currentUserId: string;
}) {
  const [type, setType] = useState<RoadblockType>(roadblock.roadblockType ?? "OTHER");
  const [ownerId, setOwnerId] = useState(roadblock.roadblockOwnerId ?? "");
  const [dueDate, setDueDate] = useState(
    roadblock.roadblockDueDate ? new Date(roadblock.roadblockDueDate).toISOString().slice(0, 10) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canResolve = canManage || roadblock.assignedToUserId === currentUserId;

  function saveDetails(next: { type?: RoadblockType; ownerId?: string; dueDate?: string }) {
    setError(null);
    const finalType = next.type ?? type;
    const finalOwnerId = next.ownerId ?? ownerId;
    const finalDueDate = next.dueDate ?? dueDate;
    startTransition(async () => {
      const result = await updateRoadblockDetails({
        taskId: roadblock.id,
        roadblockType: finalType,
        roadblockOwnerId: finalOwnerId || null,
        roadblockDueDate: finalDueDate || null,
      });
      if (!result.success) setError(result.error);
    });
  }

  function handleResolve() {
    setError(null);
    startTransition(async () => {
      const result = await resolveRoadblock({ taskId: roadblock.id });
      if (!result.success) setError(result.error);
    });
  }

  return (
    <tr className="hover:bg-surface-soft/40 transition-colors align-top">
      <td className="px-4 py-3.5 font-semibold tracking-tight text-ink">{roadblock.name}</td>
      <td className="px-4 py-3.5">
        {canManage ? (
          <select
            value={type}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value as RoadblockType;
              setType(v);
              saveDetails({ type: v });
            }}
            className="h-8 rounded-lg border border-hairline bg-surface-soft px-2 text-xs font-medium text-ink focus:bg-canvas focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all shadow-2xs"
          >
            {ROADBLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {ROADBLOCK_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs font-medium text-ink/80">{ROADBLOCK_TYPE_LABELS[type]}</span>
        )}
      </td>
      <td className="max-w-[280px] px-4 py-3.5 text-ink leading-relaxed">
        <p className="text-xs">{roadblock.roadblockNote}</p>
        {roadblock.roadblockAttachment && (
          <button
            type="button"
            onClick={() => openPdfViewer(
              roadblock.roadblockAttachment!.fileUrl,
              roadblock.roadblockAttachment!.fileName,
              "dashboard",
              {
                page: roadblock.roadblockPageNumber ?? 1,
                highlight: roadblock.roadblockCitationExcerpt,
              }
            )}
            className="btn-interactive mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-surface-soft border border-hairline text-[11px] font-semibold text-ink hover:bg-canvas transition-colors shadow-2xs"
          >
            {roadblock.roadblockAttachment.fileName}
            {roadblock.roadblockPageNumber ? `, p. ${roadblock.roadblockPageNumber}` : ""}
            <ExternalLink size={10} aria-hidden />
          </button>
        )}
        {roadblock.roadblockCitationExcerpt && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-muted italic">
            &ldquo;{roadblock.roadblockCitationExcerpt}&rdquo;
          </p>
        )}
      </td>
      <td className="px-4 py-3.5">
        {canManage ? (
          <select
            value={ownerId}
            disabled={pending}
            onChange={(e) => {
              setOwnerId(e.target.value);
              saveDetails({ ownerId: e.target.value });
            }}
            className="h-8 rounded-lg border border-hairline bg-surface-soft px-2 text-xs font-medium text-ink focus:bg-canvas focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all shadow-2xs"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs text-muted font-medium">{members.find((m) => m.id === ownerId)?.name ?? "Unassigned"}</span>
        )}
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap">
        {canManage ? (
          <input
            type="date"
            value={dueDate}
            disabled={pending}
            onChange={(e) => {
              setDueDate(e.target.value);
              saveDetails({ dueDate: e.target.value });
            }}
            className="h-8 rounded-lg border border-hairline bg-canvas px-2 text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
          />
        ) : (
          <span className="text-xs text-muted font-mono">{dueDate ? formatDate(new Date(dueDate)) : "—"}</span>
        )}
      </td>
      <td className="px-4 py-3.5 text-xs text-muted whitespace-nowrap font-medium">{roadblock.raisedByName}</td>
      <td className="px-4 py-3.5">
        {roadblock.roadblockStatus && <RoadblockBadge status={roadblock.roadblockStatus} />}
      </td>
      <td className="px-4 py-3.5 text-right whitespace-nowrap">
        {roadblock.roadblockStatus === "OPEN" && canResolve && (
          <Button variant="secondary" className="h-7 px-2.5 text-xs font-semibold shadow-2xs" onClick={handleResolve} disabled={pending}>
            {pending ? "…" : "Resolve"}
          </Button>
        )}
        <ErrorText>{error}</ErrorText>
      </td>
    </tr>
  );
}
