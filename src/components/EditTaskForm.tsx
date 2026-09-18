"use client";

import { useState, FormEvent } from "react";
import { updateTask } from "@/app/actions/tasks";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ErrorText } from "@/components/ui/ErrorText";
import type { TaskRow, MemberOption } from "@/components/TaskTable";

function toDateInput(date: Date) {
  return new Date(date).toISOString().slice(0, 10);
}

export function EditTaskForm({
  task,
  members,
  onDone,
}: {
  task: TaskRow;
  members: MemberOption[];
  onDone: () => void;
}) {
  const [name, setName] = useState(task.name);
  const [assignedToId, setAssignedToId] = useState(task.assignedTo?.id ?? "");
  const [startDate, setStartDate] = useState(toDateInput(task.startDate));
  const [endDate, setEndDate] = useState(toDateInput(task.endDate));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await updateTask({
      taskId: task.id,
      name,
      assignedToId: assignedToId || null,
      startDate,
      endDate,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 bg-surface-soft p-4 rounded-lg">
      <div className="flex-1 min-w-[160px]">
        <Input aria-label="Task name" value={name} onChange={(e) => setName(e.target.value)} required />
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
        {loading ? "Saving…" : "Save"}
      </Button>
      <Button type="button" variant="secondary" className="h-10" onClick={onDone}>
        Cancel
      </Button>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
