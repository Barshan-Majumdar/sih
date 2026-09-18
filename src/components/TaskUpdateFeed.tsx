"use client";

import { useRef, useState } from "react";
import { addTaskUpdate } from "@/app/actions/task-updates";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";

export type TaskUpdateRow = {
  id: string;
  note: string | null;
  photoUrl: string | null;
  createdAt: Date;
  author: { name: string };
};

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function TaskUpdateFeed({ taskId, updates }: { taskId: string; updates: TaskUpdateRow[] }) {
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file && !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PNG, JPEG, or WebP photo.");
      e.target.value = "";
      setPreview(null);
      return;
    }
    if (file && file.size > 5 * 1024 * 1024) {
      setError(`${file.name} is larger than 5 MB.`);
      e.target.value = "";
      setPreview(null);
      return;
    }
    setError(null);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const formData = new FormData(formRef.current!);
    formData.set("taskId", taskId);
    const result = await addTaskUpdate(formData);
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setNote("");
    setPreview(null);
    formRef.current?.reset();
  }

  return (
    <div>
      <form ref={formRef} onSubmit={handleSubmit} className="border border-hairline rounded-lg p-4 bg-surface-soft mb-6">
        <h3 className="app-card-title mb-3">Post a field update</h3>
        <textarea
          aria-label="Field update"
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What's happening on site?"
          rows={2}
          maxLength={1000}
          className="w-full text-sm rounded-md border border-hairline px-3 py-2 focus:outline-none focus:border-ink resize-none mb-3"
        />
        <div className="flex flex-wrap items-center gap-3">
          <input
            aria-label="Field update photo"
            ref={fileInputRef}
            type="file"
            name="photo"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="text-xs text-muted"
          />
          <Button type="submit" variant="secondary" disabled={loading}>
            {loading ? "Posting…" : "Post update"}
          </Button>
        </div>
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Preview" className="mt-3 h-24 rounded-md border border-hairline object-cover" />
        )}
        <ErrorText>{error}</ErrorText>
      </form>

      {updates.length === 0 ? (
        <p className="app-empty-title py-6 text-center">No field updates yet</p>
      ) : (
        <ul className="space-y-4">
          {updates.map((u) => (
            <li key={u.id} className="border-b border-hairline-soft pb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="app-card-title">{u.author.name}</span>
                <span className="text-xs text-muted-soft">{formatDateTime(u.createdAt)}</span>
              </div>
              {u.note && <p className="text-sm text-body mb-2">{u.note}</p>}
              {u.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={u.photoUrl}
                  alt="Field update"
                  className="rounded-md border border-hairline object-cover max-w-xs h-auto"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
