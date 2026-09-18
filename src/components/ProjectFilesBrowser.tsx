"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Download,
  FileImage,
  FileText,
  FolderOpen,
  LoaderCircle,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { AgentIcon } from "@/components/AgentIcon";
import { fileDownloadUrl, openPdfViewer } from "@/lib/pdf-viewer";
import {
  isAllowedAssistantAttachmentType,
  MAX_ASSISTANT_ATTACHMENT_BYTES,
} from "@/lib/assistant-attachments";

export type ProjectFileKind = "PROJECT_DOCUMENT" | "AI_UPLOAD" | "DRAWING" | "FIELD_PHOTO";
export type DocumentProcessingState = "PENDING" | "PROCESSING" | "READY" | "FAILED" | "UNSUPPORTED";

export type ProjectFileRecord = {
  id: string;
  kind: ProjectFileKind;
  name: string;
  originalFileName: string;
  mediaType: string;
  url: string;
  viewerUrl?: string;
  sizeBytes: number | null;
  uploadedBy: string;
  uploadedAt: string;
  uploadedAtLabel: string;
  sourceLabel: string;
  sourceHref: string | null;
  sourceActionLabel: string;
  conversationId: string | null;
  detail: string | null;
  extractionStatus: DocumentProcessingState | null;
  extractionError: string | null;
  canDelete: boolean;
};

const FILTERS: Array<{ value: "ALL" | ProjectFileKind; label: string }> = [
  { value: "ALL", label: "All files" },
  { value: "PROJECT_DOCUMENT", label: "Direct uploads" },
  { value: "AI_UPLOAD", label: "AI uploads" },
  { value: "DRAWING", label: "Drawings" },
  { value: "FIELD_PHOTO", label: "Field photos" },
];

const KIND_LABELS: Record<ProjectFileKind, string> = {
  PROJECT_DOCUMENT: "Project file",
  AI_UPLOAD: "AI upload",
  DRAWING: "Drawing",
  FIELD_PHOTO: "Field photo",
};

function formatBytes(sizeBytes: number | null): string {
  if (sizeBytes === null) return "Size unavailable";
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ProcessingStatus({
  file,
  processing,
  onRetry,
}: {
  file: ProjectFileRecord;
  processing: boolean;
  onRetry: () => void;
}) {
  if (!file.extractionStatus) return null;
  if (processing || file.extractionStatus === "PENDING" || file.extractionStatus === "PROCESSING") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-muted">
        <LoaderCircle size={11} className="animate-spin" aria-hidden />
        Processing text
      </span>
    );
  }
  if (file.extractionStatus === "READY") {
    return <span className="text-[11px] font-medium text-success">Search ready</span>;
  }
  if (file.extractionStatus === "UNSUPPORTED") {
    return (
      <span className="text-[11px] text-muted" title={file.extractionError ?? undefined}>
        Stored only
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-1 text-[11px] font-medium text-error hover:underline"
      title={file.extractionError ?? "Text extraction failed"}
    >
      <RotateCcw size={11} aria-hidden />
      Retry extraction
    </button>
  );
}

function FileThumb({ file }: { file: ProjectFileRecord }) {
  if (file.mediaType.startsWith("image/")) {
    return (
      // Authenticated file previews need the browser session cookie.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={file.url}
        alt=""
        className="h-10 w-10 shrink-0 rounded-md border border-hairline object-cover"
      />
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-hairline bg-surface-soft text-muted">
      <FileText size={18} aria-hidden />
    </span>
  );
}

function FileNameAction({ file }: { file: ProjectFileRecord }) {
  if (file.mediaType === "application/pdf" || file.viewerUrl) {
    return (
      <button
        type="button"
        onClick={() => openPdfViewer(file.viewerUrl ?? file.url, file.name, "dashboard")}
        className="block max-w-full truncate text-left font-medium text-ink hover:underline"
      >
        {file.name}
      </button>
    );
  }
  return (
    <a href={file.url} target="_blank" rel="noreferrer" className="block truncate font-medium text-ink hover:underline">
      {file.name}
    </a>
  );
}

function SourceAction({ file }: { file: ProjectFileRecord }) {
  if (file.conversationId) {
    return (
      <button
        type="button"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("agira:open-assistant-conversation", {
              detail: { conversationId: file.conversationId },
            })
          )
        }
        className="inline-flex items-center gap-1.5 text-xs font-medium text-body transition-colors hover:text-ink"
      >
        <AgentIcon size={14} />
        {file.sourceActionLabel}
      </button>
    );
  }
  if (file.sourceHref) {
    return (
      <Link
        href={file.sourceHref}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-body transition-colors hover:text-ink"
      >
        {file.kind === "FIELD_PHOTO" ? <Camera size={13} aria-hidden /> : <FileImage size={13} aria-hidden />}
        {file.sourceActionLabel}
      </Link>
    );
  }
  return null;
}

function OpenInAgentAction({ file, projectId }: { file: ProjectFileRecord; projectId: string }) {
  if (file.extractionStatus === "PENDING" || file.extractionStatus === "PROCESSING") {
    return (
      <span className="inline-flex h-8 items-center justify-end gap-1 text-xs font-medium text-muted">
        <LoaderCircle size={12} className="animate-spin" aria-hidden />
        Processing
      </span>
    );
  }

  if (file.extractionStatus !== "READY") {
    return <span className="text-xs font-medium text-muted">Stored only</span>;
  }

  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("agira:open-project-file-agent", {
            detail: { projectId, fileName: file.name },
          })
        )
      }
      className="inline-flex h-8 items-center justify-center whitespace-nowrap rounded-md border border-hairline bg-canvas px-3 text-xs font-semibold text-ink transition-colors hover:border-muted-soft hover:bg-surface-soft"
    >
      Open in Agent
    </button>
  );
}

function DownloadFileAction({ file }: { file: ProjectFileRecord }) {
  return (
    <a
      href={fileDownloadUrl(file.url)}
      aria-label={`Download ${file.name}`}
      title="Download file"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-soft hover:text-ink"
    >
      <Download size={15} aria-hidden />
    </a>
  );
}

function DeleteFileAction({
  file,
  deleting,
  onDelete,
}: {
  file: ProjectFileRecord;
  deleting: boolean;
  onDelete: () => void;
}) {
  if (!file.canDelete) return null;

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={deleting}
      aria-label={`Delete ${file.name}`}
      title="Delete file"
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-error/8 hover:text-error disabled:cursor-wait disabled:opacity-70"
    >
      {deleting ? (
        <LoaderCircle size={15} className="animate-spin" aria-hidden />
      ) : (
        <Trash2 size={15} aria-hidden />
      )}
    </button>
  );
}

export function ProjectFilesBrowser({
  projectId,
  files,
}: {
  projectId: string;
  files: ProjectFileRecord[];
}) {
  const router = useRouter();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"ALL" | ProjectFileKind>("ALL");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const filteredFiles = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return files.filter((file) => {
      if (filter !== "ALL" && file.kind !== filter) return false;
      if (!needle) return true;
      return [file.name, file.originalFileName, file.uploadedBy, file.sourceLabel, file.detail]
        .some((value) => typeof value === "string" && value.toLowerCase().includes(needle));
    });
  }, [files, filter, query]);

  const counts = useMemo(
    () => ({
      total: files.length,
      ready: files.filter((file) => file.extractionStatus === "READY").length,
      documents: files.filter(
        (file) => file.kind === "PROJECT_DOCUMENT" || file.kind === "AI_UPLOAD"
      ).length,
      photos: files.filter((file) => file.kind === "FIELD_PHOTO").length,
    }),
    [files]
  );
  const summary = [
    { label: "All files", value: counts.total },
    { label: "Search ready", value: counts.ready },
    { label: "Documents", value: counts.documents },
    { label: "Field photos", value: counts.photos },
  ];

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList?.length) return;
    if (fileList.length > 4) {
      setUploadError("Upload up to four files at a time.");
      return;
    }
    const invalid = Array.from(fileList).find(
      (file) =>
        file.size > MAX_ASSISTANT_ATTACHMENT_BYTES ||
        !isAllowedAssistantAttachmentType(file.type)
    );
    if (invalid) {
      setUploadError(
        invalid.size > MAX_ASSISTANT_ATTACHMENT_BYTES
          ? `${invalid.name} is larger than 20 MB.`
          : `${invalid.name} must be a PDF, PNG, JPEG, or WebP file.`
      );
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(fileList)) {
        const formData = new FormData();
        formData.set("file", file);
        const response = await fetch(`/api/projects/${projectId}/files`, {
          method: "POST",
          body: formData,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error ?? `${file.name} could not be uploaded.`);
      }
      router.refresh();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "A project file could not be uploaded.");
    } finally {
      setUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  async function retryExtraction(fileId: string) {
    setProcessingId(fileId);
    setUploadError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/files/${fileId}/process`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "Text extraction could not be retried.");
      router.refresh();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Text extraction could not be retried.");
    } finally {
      setProcessingId(null);
    }
  }

  async function deleteFile(file: ProjectFileRecord) {
    if (!window.confirm(`Delete ${file.name} from this project?`)) return;
    setDeletingId(file.id);
    setUploadError(null);
    try {
      const response = await fetch(`/api/projects/${projectId}/files/${file.id}`, {
        method: "DELETE",
      });
      const payload = response.status === 204 ? null : await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error ?? "The file could not be deleted.");
      router.refresh();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "The file could not be deleted.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 border-y border-hairline md:grid-cols-4">
        {summary.map(({ label, value }, index) => (
          <div
            key={label}
            className={`px-4 py-3 ${index % 2 === 1 ? "border-l border-hairline" : ""} ${index > 1 ? "border-t border-hairline md:border-t-0" : ""} ${index > 0 ? "md:border-l md:border-hairline" : ""}`}
          >
            <p className="app-metric-label text-xs">{label}</p>
            <p className="app-metric-value text-xl">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-b border-hairline pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex max-w-full overflow-x-auto" aria-label="File type filters">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              aria-pressed={filter === item.value}
              className={`h-9 shrink-0 border px-3 text-xs font-semibold transition-colors first:rounded-l-md last:rounded-r-md ${
                filter === item.value
                  ? "border-ink bg-ink text-canvas"
                  : "-ml-px border-hairline bg-canvas text-muted hover:bg-surface-soft hover:text-ink first:ml-0"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex w-full gap-2 lg:w-auto">
          <label className="relative block min-w-0 flex-1 lg:w-72">
            <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-muted" aria-hidden />
            <span className="sr-only">Search project files</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search files, people, or sources"
              className="h-9 w-full rounded-md border border-hairline bg-canvas pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted-soft focus:border-muted-soft"
            />
          </label>
          <input
            ref={uploadInputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            multiple
            className="sr-only"
            aria-label="Choose project files"
            onChange={(event) => void uploadFiles(event.target.files)}
          />
          <button
            type="button"
            onClick={() => uploadInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-ink px-3.5 text-xs font-semibold text-canvas transition-colors hover:bg-ink/90 disabled:cursor-wait disabled:opacity-60"
          >
            {uploading ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <Upload size={14} aria-hidden />}
            {uploading ? "Indexing" : "Upload"}
          </button>
        </div>
      </div>

      {uploadError && <p className="text-sm text-error" role="alert">{uploadError}</p>}

      {filteredFiles.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center border-b border-hairline px-6 text-center">
          <FolderOpen size={24} className="text-muted-soft" aria-hidden />
          <p className="app-empty-title mt-3">{files.length === 0 ? "Add the first project file" : "No matching files"}</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-muted">
            {files.length === 0
              ? "Upload a drawing, field photo, or PDF so the team and Agent can work from the same source."
              : "Try another search term or file type."}
          </p>
          {files.length === 0 && (
            <button
              type="button"
              onClick={() => uploadInputRef.current?.click()}
              disabled={uploading}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-active disabled:opacity-60"
            >
              <Upload size={15} aria-hidden />
              Upload first file
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-md border border-hairline md:block">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="border-b border-hairline bg-surface-soft">
                <tr>
                  <th className="app-table-heading w-[34%] px-4 py-2.5">File</th>
                  <th className="app-table-heading w-[18%] px-4 py-2.5">Source</th>
                  <th className="app-table-heading w-[15%] px-4 py-2.5">Uploaded by</th>
                  <th className="app-table-heading w-[17%] px-4 py-2.5">Added</th>
                  <th className="app-table-heading w-[16%] px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map((file) => (
                  <tr key={`${file.kind}:${file.id}`} className="border-b border-hairline-soft last:border-b-0 hover:bg-surface-soft/60">
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileThumb file={file} />
                        <div className="min-w-0">
                          <FileNameAction file={file} />
                          <p className="mt-0.5 truncate text-xs text-muted">
                            {KIND_LABELS[file.kind]} - {formatBytes(file.sizeBytes)}
                            {file.detail ? ` - ${file.detail}` : ""}
                          </p>
                          <div className="mt-1">
                            <ProcessingStatus
                              file={file}
                              processing={processingId === file.id}
                              onRetry={() => void retryExtraction(file.id)}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="truncate text-xs text-muted" title={file.sourceLabel}>{file.sourceLabel}</p>
                      <div className="mt-1"><SourceAction file={file} /></div>
                    </td>
                    <td className="truncate px-4 py-3 text-xs text-body">{file.uploadedBy}</td>
                    <td className="px-4 py-3 text-xs text-muted">{file.uploadedAtLabel}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <OpenInAgentAction file={file} projectId={projectId} />
                        <DownloadFileAction file={file} />
                        <DeleteFileAction
                          file={file}
                          deleting={deletingId === file.id}
                          onDelete={() => void deleteFile(file)}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="divide-y divide-hairline border-y border-hairline md:hidden">
            {filteredFiles.map((file) => (
              <li key={`${file.kind}:${file.id}`} className="py-4">
                <div className="flex items-start gap-3">
                  <FileThumb file={file} />
                  <div className="min-w-0 flex-1">
                    <FileNameAction file={file} />
                    <p className="mt-1 text-xs text-muted">{KIND_LABELS[file.kind]} - {formatBytes(file.sizeBytes)}</p>
                    <div className="mt-1">
                      <ProcessingStatus
                        file={file}
                        processing={processingId === file.id}
                        onRetry={() => void retryExtraction(file.id)}
                      />
                    </div>
                    <p className="mt-2 truncate text-xs text-muted">{file.sourceLabel}</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <SourceAction file={file} />
                      <span className="text-[11px] text-muted-soft">{file.uploadedAtLabel}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <OpenInAgentAction file={file} projectId={projectId} />
                    <DownloadFileAction file={file} />
                    <DeleteFileAction
                      file={file}
                      deleting={deletingId === file.id}
                      onDelete={() => void deleteFile(file)}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
