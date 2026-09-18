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
    return <p className="text-sm text-muted py-8 text-center">No roadblocks match this filter.</p>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-hairline text-left text-muted">
          <th className="py-2 pr-3 font-medium">Task</th>
          <th className="py-2 pr-3 font-medium">Type</th>
          <th className="py-2 pr-3 font-medium">Note</th>
          <th className="py-2 pr-3 font-medium">Owner</th>
          <th className="py-2 pr-3 font-medium">Due</th>
          <th className="py-2 pr-3 font-medium">Raised by</th>
          <th className="py-2 pr-3 font-medium">Status</th>
          <th className="py-2 font-medium text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {roadblocks.map((r) => (
          <RoadblockRowView key={r.id} roadblock={r} members={members} canManage={canManage} currentUserId={currentUserId} />
        ))}
      </tbody>
    </table>
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
    <tr className="border-b border-hairline-soft align-top">
      <td className="py-3 pr-3 font-medium text-ink">{roadblock.name}</td>
      <td className="py-3 pr-3">
        {canManage ? (
          <select
            value={type}
            disabled={pending}
            onChange={(e) => {
              const v = e.target.value as RoadblockType;
              setType(v);
              saveDetails({ type: v });
            }}
            className="h-8 rounded-md border border-hairline bg-canvas px-2 text-xs focus:outline-none focus:border-ink"
          >
            {ROADBLOCK_TYPES.map((t) => (
              <option key={t} value={t}>
                {ROADBLOCK_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs">{ROADBLOCK_TYPE_LABELS[type]}</span>
        )}
      </td>
      <td className="max-w-[260px] py-3 pr-3 text-body">
        <p>{roadblock.roadblockNote}</p>
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
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
          >
            {roadblock.roadblockAttachment.fileName}
            {roadblock.roadblockPageNumber ? `, page ${roadblock.roadblockPageNumber}` : ""}
            <ExternalLink size={11} aria-hidden />
          </button>
        )}
        {roadblock.roadblockCitationExcerpt && (
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
            {roadblock.roadblockCitationExcerpt}
          </p>
        )}
      </td>
      <td className="py-3 pr-3">
        {canManage ? (
          <select
            value={ownerId}
            disabled={pending}
            onChange={(e) => {
              setOwnerId(e.target.value);
              saveDetails({ ownerId: e.target.value });
            }}
            className="h-8 rounded-md border border-hairline bg-canvas px-2 text-xs focus:outline-none focus:border-ink"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="text-xs">{members.find((m) => m.id === ownerId)?.name ?? "Unassigned"}</span>
        )}
      </td>
      <td className="py-3 pr-3 whitespace-nowrap">
        {canManage ? (
          <input
            type="date"
            value={dueDate}
            disabled={pending}
            onChange={(e) => {
              setDueDate(e.target.value);
              saveDetails({ dueDate: e.target.value });
            }}
            className="h-8 rounded-md border border-hairline bg-canvas px-2 text-xs focus:outline-none focus:border-ink"
          />
        ) : (
          <span className="text-xs text-muted">{dueDate ? formatDate(new Date(dueDate)) : "—"}</span>
        )}
      </td>
      <td className="py-3 pr-3 text-muted whitespace-nowrap">{roadblock.raisedByName}</td>
      <td className="py-3 pr-3">
        {roadblock.roadblockStatus && <RoadblockBadge status={roadblock.roadblockStatus} />}
      </td>
      <td className="py-3 text-right whitespace-nowrap">
        {roadblock.roadblockStatus === "OPEN" && canResolve && (
          <Button variant="text" className="text-xs" onClick={handleResolve} disabled={pending}>
            {pending ? "…" : "Resolve"}
          </Button>
        )}
        <ErrorText>{error}</ErrorText>
      </td>
    </tr>
  );
}
