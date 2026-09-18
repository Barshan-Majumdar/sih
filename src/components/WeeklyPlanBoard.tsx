"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleMinus } from "lucide-react";
import { commitToWeek, removeFutureCommitment, updateCommitmentStatus } from "@/app/actions/weekly-plan";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { COMMITMENT_STATUS_LABELS } from "@/lib/utils";
import type { CommitmentStatus } from "@prisma/client";

export type CommitmentRow = {
  id: string;
  status: CommitmentStatus;
  reasonForVariance: string | null;
  canRemove: boolean;
  task: { id: string; name: string };
  committedBy: { user: { name: string } };
};

export type CommittableTask = { id: string; name: string };

const STATUS_OPTIONS: CommitmentStatus[] = ["COMMITTED", "COMPLETED", "NOT_COMPLETED"];

export function WeeklyPlanBoard({
  weekStartDate,
  commitments,
  committableTasks,
}: {
  weekStartDate: string;
  commitments: CommitmentRow[];
  committableTasks: CommittableTask[];
}) {
  return (
    <div className="space-y-4">
      {commitments.length === 0 ? (
        <div className="rounded-md border border-dashed border-hairline px-6 py-10 text-center">
          <p className="app-empty-title">No commitments for this week</p>
          <p className="mt-2 text-sm text-muted">Commit field-ready tasks below to build the weekly plan.</p>
        </div>
      ) : (
        <div className="app-table-wrap overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-hairline bg-surface-soft text-left">
                <th className="app-table-heading px-4 py-2.5">Task</th>
                <th className="app-table-heading px-4 py-2.5">Committed by</th>
                <th className="app-table-heading px-4 py-2.5">Status</th>
                <th className="app-table-heading w-32 px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {commitments.map((c) => (
                <CommitmentRowView
                  key={`${c.id}:${c.status}:${c.reasonForVariance ?? ""}:${c.canRemove}`}
                  commitment={c}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {committableTasks.length > 0 && <CommitForm weekStartDate={weekStartDate} tasks={committableTasks} />}
    </div>
  );
}

function CommitmentRowView({ commitment }: { commitment: CommitmentRow }) {
  const [status, setStatus] = useState(commitment.status);
  const [reason, setReason] = useState(commitment.reasonForVariance ?? "");
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleStatusChange(next: CommitmentStatus) {
    setStatus(next);
    setError(null);
    if (next !== "NOT_COMPLETED") {
      startTransition(async () => {
        const result = await updateCommitmentStatus({ commitmentId: commitment.id, status: next });
        if (!result.success) setError(result.error);
      });
    }
  }

  function handleSaveReason() {
    setError(null);
    startTransition(async () => {
      const result = await updateCommitmentStatus({
        commitmentId: commitment.id,
        status: "NOT_COMPLETED",
        reasonForVariance: reason,
      });
      if (!result.success) setError(result.error);
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeFutureCommitment({ commitmentId: commitment.id });
      if (!result.success) {
        setError(result.error);
        setConfirmingRemoval(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <tr className="app-table-row border-b border-hairline-soft align-top last:border-b-0">
      <td className="px-4 py-3 font-medium text-ink">{commitment.task.name}</td>
      <td className="px-4 py-3 text-muted">{commitment.committedBy.user.name}</td>
      <td className="px-4 py-3">
        <select
          aria-label={`Status for ${commitment.task.name}`}
          value={status}
          disabled={pending}
          onChange={(e) => handleStatusChange(e.target.value as CommitmentStatus)}
          className="h-8 rounded-md border border-hairline bg-canvas px-2 text-xs focus:outline-none focus:border-ink disabled:opacity-50"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {COMMITMENT_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {status === "NOT_COMPLETED" && (
          <div className="mt-2 flex items-center gap-2">
            <input
              aria-label={`Variance reason for ${commitment.task.name}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason for variance"
              className="h-8 flex-1 min-w-[160px] rounded-md border border-hairline bg-canvas px-2 text-xs focus:outline-none focus:border-ink"
            />
            <Button variant="secondary" className="h-8 px-2 text-xs" onClick={handleSaveReason} disabled={pending}>
              Save
            </Button>
          </div>
        )}
        <ErrorText>{error}</ErrorText>
      </td>
      <td className="px-4 py-3">
        {commitment.canRemove &&
          (confirmingRemoval ? (
            <div className="flex items-center gap-1.5">
              <Button variant="text" className="h-8 px-2 text-xs" onClick={handleRemove} disabled={pending}>
                {pending ? "Removing..." : "Remove"}
              </Button>
              <Button
                variant="ghost"
                className="h-8 px-2 text-xs"
                onClick={() => setConfirmingRemoval(false)}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 text-muted hover:text-error"
              onClick={() => setConfirmingRemoval(true)}
              aria-label={`Remove ${commitment.task.name} from this weekly plan`}
              title="Remove from weekly plan"
            >
              <CircleMinus size={16} aria-hidden />
            </Button>
          ))}
      </td>
    </tr>
  );
}

function CommitForm({ weekStartDate, tasks }: { weekStartDate: string; tasks: CommittableTask[] }) {
  const [taskId, setTaskId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleCommit() {
    if (!taskId) return;
    setError(null);
    setLoading(true);
    const result = await commitToWeek({ taskId, weekStartDate });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setTaskId("");
  }

  return (
    <div className="rounded-md border border-hairline bg-surface-soft p-4">
      <p className="app-kicker mb-1">Weekly commitment</p>
      <h3 className="app-card-title mb-3">Add work to this week</h3>
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Task to commit"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        >
          <option value="">Select a task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button variant="secondary" onClick={handleCommit} disabled={loading || !taskId}>
          {loading ? "Committing…" : "Commit"}
        </Button>
      </div>
      <p className="text-xs text-muted-soft mt-2">
        Future commitments can be removed before their week begins. Current and past commitments stay in the plan.
      </p>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
