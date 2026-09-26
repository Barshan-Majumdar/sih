"use client";

import { useRef, useState } from "react";
import { addTaskUpdate } from "@/app/actions/task-updates";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { Camera, Image as ImageIcon, MessageSquare, Send, X, Clock } from "lucide-react";

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

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
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

  function handleClearPhoto() {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setPreview(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim() && !fileInputRef.current?.files?.[0]) {
      setError("Please write an update note or attach a site photo.");
      return;
    }
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
    <div className="space-y-6">
      {/* Post Update Form */}
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="rounded-2xl border border-hairline bg-surface-card p-5 shadow-card transition-all hover:border-hairline"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Post Field Update</h3>
              <p className="text-xs text-muted">Log site conditions, milestones, or attach photo verification.</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-muted tabular-nums">
            {note.length}/1000
          </span>
        </div>

        <textarea
          aria-label="Field update"
          name="note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Describe crew progress, current phase, material drops, or inspection notes..."
          rows={3}
          maxLength={1000}
          className="w-full text-sm rounded-xl border border-hairline bg-canvas px-3.5 py-2.5 text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent resize-none transition-all"
        />

        {/* Photo Preview Thumbnail */}
        {preview && (
          <div className="relative mt-3 inline-block rounded-xl border border-hairline bg-surface-soft p-1.5 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Site update preview"
              className="h-28 w-auto max-w-xs rounded-lg object-cover"
            />
            <button
              type="button"
              onClick={handleClearPhoto}
              className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface-card border border-hairline text-muted hover:text-error shadow-sm transition-transform hover:scale-110"
              aria-label="Remove photo"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-hairline-soft pt-3">
          <div className="flex items-center gap-2">
            <input
              aria-label="Field update photo"
              ref={fileInputRef}
              type="file"
              name="photo"
              id="task-update-photo"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="sr-only"
            />
            <label
              htmlFor="task-update-photo"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-hairline bg-surface-soft px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface-strong hover:text-brand-accent"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Attach photo</span>
            </label>
            <span className="text-[11px] text-muted">PNG, JPG, WebP up to 5MB</span>
          </div>

          <Button type="submit" variant="primary" disabled={loading} className="gap-1.5 shadow-sm">
            <Send className="h-3.5 w-3.5" />
            {loading ? "Posting..." : "Post update"}
          </Button>
        </div>

        {error && <ErrorText className="mt-3">{error}</ErrorText>}
      </form>

      {/* Feed Stream */}
      {updates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-hairline bg-canvas p-10 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-soft text-muted mb-2">
            <Clock className="h-5 w-5" />
          </div>
          <p className="app-empty-title text-sm">No field updates recorded yet</p>
          <p className="text-xs text-muted mt-1">Field notes and photo progress will appear here in chronological order.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">Field Activity History</h4>
            <span className="text-xs font-mono text-muted tabular-nums">{updates.length} updates</span>
          </div>

          <div className="relative border-l border-hairline ml-3.5 pl-6 space-y-6">
            {updates.map((u) => (
              <div key={u.id} className="relative group">
                {/* Timeline node */}
                <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-canvas border-2 border-brand-accent" />

                <div className="rounded-2xl border border-hairline bg-surface-card p-4 shadow-sm transition-all group-hover:border-muted-soft group-hover:shadow-card">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-accent/15 text-[10px] font-bold text-brand-accent">
                        {getInitials(u.author.name)}
                      </span>
                      <span className="text-sm font-semibold text-ink">{u.author.name}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted font-mono">
                      <Clock className="h-3 w-3" />
                      {formatDateTime(u.createdAt)}
                    </span>
                  </div>

                  {u.note && (
                    <p className="text-sm text-body leading-relaxed whitespace-pre-wrap mb-3">
                      {u.note}
                    </p>
                  )}

                  {u.photoUrl && (
                    <div className="mt-2 overflow-hidden rounded-xl border border-hairline bg-surface-soft inline-block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={u.photoUrl}
                        alt="Field progress attachment"
                        className="max-h-72 w-auto object-cover transition-transform duration-300 hover:scale-[1.02]"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
