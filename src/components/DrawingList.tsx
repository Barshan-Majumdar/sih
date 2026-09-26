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
        <div className="rounded-2xl border border-dashed border-hairline bg-surface-soft/40 px-6 py-12 text-center">
          <p className="text-sm font-semibold tracking-tight text-ink">No drawings uploaded yet</p>
          <p className="mt-1 text-xs text-muted">Upload revision sheets and blueprints to connect with schedule tasks.</p>
        </div>
      ) : (
        <ul className="space-y-3.5">
          {drawings.map((d) => (
            <li
              key={d.id}
              className={`rounded-2xl border p-5 transition-all shadow-card hover:shadow-card-hover bg-canvas ${
                d.isSuperseded ? "border-hairline/60 opacity-60" : "border-hairline"
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <a
                  href={d.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold tracking-tight text-ink hover:underline"
                >
                  {d.title}
                </a>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold font-mono border border-hairline bg-surface-soft text-ink">
                  Rev {d.revision}
                  {d.isSuperseded && " · superseded"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted font-mono">
                {d.source === "AUTODESK" && (
                  <span className="font-sans px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 text-[10px] font-bold">
                    From ACC
                  </span>
                )}
                {d.discipline && <span className="font-sans font-medium text-ink/80">{d.discipline}</span>}
                {d.task && <span className="font-sans font-medium text-ink">Task: {d.task.name}</span>}
                <span>Uploaded by {d.uploadedBy.user.name}</span>
                <span>{formatDate(d.createdAt)}</span>
              </div>
              {d.fileUrl.endsWith(".pdf") ? null : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={d.fileUrl}
                  alt={d.title}
                  className="mt-3.5 max-h-52 rounded-xl border border-hairline object-contain bg-surface-soft/40 p-1"
                />
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
    <form ref={formRef} onSubmit={handleSubmit} className="rounded-2xl border border-hairline bg-surface-soft/80 p-5 shadow-card">
      <div className="mb-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Architectural & Structural</p>
        <h3 className="text-sm font-semibold tracking-tight text-ink mt-0.5">Upload a Drawing</h3>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          aria-label="Drawing title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. A-101 Floor Plan) — reuse to supersede a prior revision"
          className="h-9 flex-1 min-w-[260px] rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
        />
        <input
          aria-label="Drawing discipline"
          name="discipline"
          placeholder="Discipline"
          className="h-9 w-32 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all"
        />
        <select
          aria-label="Linked task"
          name="taskId"
          className="h-9 rounded-xl border border-hairline bg-canvas px-3 text-xs sm:text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink/20 focus:border-ink transition-all shadow-2xs"
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
          className="text-xs text-muted file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border file:border-hairline file:text-xs file:font-semibold file:bg-surface-soft hover:file:bg-canvas file:text-ink cursor-pointer"
        />
        <Button type="submit" variant="primary" disabled={loading || !title.trim()} className="h-9 text-xs font-semibold shadow-2xs">
          {loading ? "Uploading…" : "Upload"}
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}
