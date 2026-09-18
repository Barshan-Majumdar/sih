"use client";

import { useState, FormEvent } from "react";
import { createTask } from "@/app/actions/tasks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorText } from "@/components/ui/ErrorText";
import type { MemberOption } from "@/components/TaskTable";

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
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <span className="text-lg leading-none" aria-hidden>+</span>
        Add task
      </Button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 rounded-md border border-hairline bg-surface-soft p-3">
      <div className="flex-1 min-w-[160px]">
        <Input
          aria-label="Task name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Task name"
          required
          autoFocus
        />
      </div>
      <select
        aria-label="Assignee"
        value={assignedToId}
        onChange={(e) => setAssignedToId(e.target.value)}
        className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <Input aria-label="Task start date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required className="w-40" />
      <Input aria-label="Task end date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required className="w-40" />
      <Button type="submit" disabled={loading} className="h-10">
        {loading ? "Adding…" : "Add"}
      </Button>
      <Button type="button" variant="secondary" className="h-10" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
