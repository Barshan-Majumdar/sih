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
    <div className="space-y-6">
      {commitments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-surface-soft/40 px-6 py-12 text-center">
          <p className="text-sm font-semibold tracking-tight text-ink">No commitments for this week</p>
          <p className="mt-1 text-xs text-muted">Commit field-ready tasks below to build the weekly plan.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-hairline bg-canvas shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm text-left">
              <thead>
                <tr className="border-b border-hairline bg-surface-soft/80 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="px-4 py-3">Task</th>
                  <th className="px-4 py-3">Committed by</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="w-32 px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {commitments.map((c) => (
                  <CommitmentRowView
                    key={`${c.id}:${c.status}:${c.reasonForVariance ?? ""}:${c.canRemove}`}
                    commitment={c}
                  />
                ))}
              </tbody>
            </table>
          </div>
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
    <tr className="hover:bg-surface-soft/40 transition-colors align-top">
      <td className="px-4 py-3.5 font-semibold tracking-tight text-ink">{commitment.task.name}</td>
      <td className="px-4 py-3.5 text-xs text-muted font-medium">{commitment.committedBy.user.name}</td>
      <td className="px-4 py-3.5">
        <select
          aria-label={`Status for ${commitment.task.name}`}
          value={status}
          disabled={pending}
          onChange={(e) => handleStatusChange(e.target.value as CommitmentStatus)}
          className="h-8 rounded-lg border border-hairline bg-surface-soft px-2.5 text-xs font-semibold text-ink focus:bg-canvas focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink disabled:opacity-50 transition-all shadow-2xs"
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
              className="h-8 flex-1 min-w-[160px] rounded-lg border border-hairline bg-canvas px-2.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
            />
            <Button variant="secondary" className="h-8 px-2.5 text-xs font-semibold shadow-2xs" onClick={handleSaveReason} disabled={pending}>
              Save
            </Button>
          </div>
        )}
        <ErrorText>{error}</ErrorText>
      </td>
      <td className="px-4 py-3.5">
        {commitment.canRemove &&
          (confirmingRemoval ? (
            <div className="flex items-center gap-1.5">
              <Button variant="danger" className="h-7 px-2 text-[11px] font-semibold" onClick={handleRemove} disabled={pending}>
                {pending ? "Removing..." : "Remove"}
              </Button>
              <Button
                variant="ghost"
                className="h-7 px-2 text-[11px]"
                onClick={() => setConfirmingRemoval(false)}
                disabled={pending}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              className="h-7 w-7 p-0 text-muted hover:text-rose-600 rounded-lg hover:bg-rose-500/10 transition-colors"
              onClick={() => setConfirmingRemoval(true)}
              aria-label={`Remove ${commitment.task.name} from this weekly plan`}
              title="Remove from weekly plan"
            >
              <CircleMinus size={15} aria-hidden />
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
    <div className="rounded-2xl border border-hairline bg-surface-soft/80 p-5 shadow-card">
      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Weekly commitment</p>
        <h3 className="text-sm font-semibold tracking-tight text-ink mt-0.5">Add work to this week</h3>
        <p className="text-xs text-muted mt-0.5">
          Future commitments can be removed before their week begins. Current and past commitments stay in the plan.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          aria-label="Task to commit"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="h-9 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
        >
          <option value="">Select a task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <Button variant="primary" onClick={handleCommit} disabled={loading || !taskId} className="h-9 text-xs font-semibold shadow-2xs">
          {loading ? "Committing…" : "Commit task"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
