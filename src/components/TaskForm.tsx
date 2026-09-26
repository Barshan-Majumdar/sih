"use client";

import { useState, FormEvent } from "react";
import { createTask } from "@/app/actions/tasks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorText } from "@/components/ui/ErrorText";
import type { MemberOption } from "@/components/TaskTable";
import { Plus, X, Calendar, User } from "lucide-react";

export function TaskForm({ projectId, members }: { projectId: string; members: MemberOption[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await createTask({
      projectId,
      name,
      assignedToId: assignedToId || undefined,
      startDate,
      endDate,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setName("");
    setAssignedToId("");
    setStartDate("");
    setEndDate("");
    setOpen(false);
  }

  if (!open) {
    return (
      <Button variant="primary" onClick={() => setOpen(true)} className="gap-1.5 shadow-sm">
        <Plus className="h-4 w-4" />
        <span>Add Activity</span>
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-hairline bg-surface-card p-4 shadow-card transition-all"
    >
      <div className="flex-1 min-w-[200px]">
        <label className="block text-xs font-medium text-muted mb-1">Activity Name</label>
        <Input
          aria-label="Task name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Level 2 Post-Tension Slab Pour"
          required
          autoFocus
          className="h-10 text-sm"
        />
      </div>

      <div className="min-w-[150px]">
        <label className="block text-xs font-medium text-muted mb-1">Assignee</label>
        <select
          aria-label="Assignee"
          value={assignedToId}
          onChange={(e) => setAssignedToId(e.target.value)}
          className="h-10 w-full rounded-xl border border-hairline bg-canvas px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="w-36">
        <label className="block text-xs font-medium text-muted mb-1">Start Date</label>
        <Input
          aria-label="Task start date"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          required
          className="h-10 text-sm font-mono"
        />
      </div>

      <div className="w-36">
        <label className="block text-xs font-medium text-muted mb-1">End Date</label>
        <Input
          aria-label="Task end date"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          required
          className="h-10 text-sm font-mono"
        />
      </div>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary" disabled={loading} className="h-10 shadow-sm">
          {loading ? "Adding…" : "Save Task"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-10"
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>

      {error && (
        <div className="w-full mt-2">
          <ErrorText>{error}</ErrorText>
        </div>
      )}
    </form>
  );
}
