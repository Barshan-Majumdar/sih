"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadDrawing } from "@/app/actions/drawings";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { formatDate } from "@/lib/utils";
import type { IntegrationSource } from "@prisma/client";

export type DrawingRow = {
  id: string;
  title: string;
  discipline: string | null;
  fileUrl: string;
  revision: number;
  isSuperseded: boolean;
  source: IntegrationSource;
  createdAt: Date;
  uploadedBy: { user: { name: string } };
  task: { id: string; name: string } | null;
};

export type TaskOption = { id: string; name: string };

export function DrawingList({
  projectId,
  drawings,
  tasks,
  canUpload,
}: {
  projectId: string;
  drawings: DrawingRow[];
  tasks: TaskOption[];
  canUpload: boolean;
}) {
  return (
    <div className="space-y-6">
      {canUpload && <UploadDrawingForm projectId={projectId} tasks={tasks} />}

      {drawings.length === 0 ? (
        <p className="app-empty-title py-6 text-center">No drawings uploaded yet</p>
      ) : (
        <ul className="space-y-3">
          {drawings.map((d) => (
            <li key={d.id} className={`border rounded-lg p-4 ${d.isSuperseded ? "border-hairline-soft opacity-60" : "border-hairline"}`}>
              <div className="flex items-center justify-between mb-1">
                <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="app-card-title hover:underline">
                  {d.title}
                </a>
                <span className="text-xs text-muted">
                  Rev {d.revision}
                  {d.isSuperseded && " — superseded"}
                </span>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted">
                {d.source === "AUTODESK" && <span className="text-muted-soft">From ACC</span>}
                {d.discipline && <span>{d.discipline}</span>}
                {d.task && <span>Task: {d.task.name}</span>}
                <span>Uploaded by {d.uploadedBy.user.name}</span>
                <span>{formatDate(d.createdAt)}</span>
              </div>
              {d.fileUrl.endsWith(".pdf") ? null : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.fileUrl} alt={d.title} className="mt-3 max-h-48 rounded-md border border-hairline object-contain" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UploadDrawingForm({ projectId, tasks }: { projectId: string; tasks: TaskOption[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(formRef.current!);
    formData.set("projectId", projectId);
    const result = await uploadDrawing(formData);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setTitle("");
    formRef.current?.reset();
    router.refresh();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="border border-hairline rounded-lg p-4 bg-surface-soft">
      <h3 className="app-card-title mb-3">Upload a Drawing</h3>
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Drawing title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. A-101 Floor Plan) — reuse to supersede a prior revision"
          className="h-10 flex-1 min-w-[260px] rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <input
          aria-label="Drawing discipline"
          name="discipline"
          placeholder="Discipline"
          className="h-10 w-32 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        />
        <select
          aria-label="Linked task"
          name="taskId"
          className="h-10 rounded-md border border-hairline bg-canvas px-3 text-sm focus:outline-none focus:border-ink"
        >
          <option value="">No linked task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Drawing file"
          name="file"
          type="file"
          accept="application/pdf,image/png,image/jpeg,image/webp"
          className="text-xs text-muted"
        />
        <Button type="submit" variant="secondary" disabled={loading || !title.trim()}>
          {loading ? "Uploading…" : "Upload"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
