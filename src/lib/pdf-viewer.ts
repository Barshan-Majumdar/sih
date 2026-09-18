export type PdfViewerPlacement = "dashboard" | "agent";

export type PdfViewerDocument = {
  url: string;
  title: string;
  page: number;
  pageCount?: number | null;
  highlight?: string | null;
};

export type PdfViewerRequest = PdfViewerDocument & {
  placement: PdfViewerPlacement;
};

export const PDF_VIEWER_EVENT = "agira:open-pdf-viewer";

const COMMON_CITATION_WORDS = new Set([
  "about", "after", "before", "could", "document", "from", "have", "into", "page",
  "project", "shall", "should", "that", "their", "there", "these", "this", "with",
]);

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function highlightPdfTextItem(text: string, excerpt?: string | null): string {
  if (!excerpt?.trim()) return escapeHtml(text);
  const terms = [
    ...new Set(
      excerpt
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu)
        ?.filter((term) => term.length >= 4 && !COMMON_CITATION_WORDS.has(term)) ?? []
    ),
  ]
    .sort((left, right) => right.length - left.length)
    .slice(0, 18);
  if (terms.length === 0) return escapeHtml(text);

  const pattern = new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "giu"
  );
  return escapeHtml(text).replace(
    pattern,
    '<mark data-pdf-citation-highlight="true" style="border-radius:2px;background:#ffe58a;color:#181611">$1</mark>'
  );
}

function positivePage(value: string | null | undefined): number | null {
  if (!value) return null;
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : null;
}

export function pdfViewerDocument(
  url: string,
  title: string,
  options?: { page?: number; pageCount?: number | null; highlight?: string | null }
): PdfViewerDocument {
  const [baseUrl, hash = ""] = url.split("#", 2);
  const hashPage = positivePage(new URLSearchParams(hash).get("page"));
  return {
    url: baseUrl,
    title,
    page: options?.page ?? hashPage ?? 1,
    pageCount: options?.pageCount,
    highlight: options?.highlight,
  };
}

export function pdfPageUrl(document: PdfViewerDocument): string {
  const page = Math.max(1, Math.floor(document.page));
  return `${document.url}#page=${page}&zoom=page-width`;
}

export function fileDownloadUrl(url: string): string {
  const [baseUrl] = url.split("#", 1);
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}download=1`;
}

export function openPdfViewer(
  url: string,
  title: string,
  placement: PdfViewerPlacement,
  options?: { page?: number; pageCount?: number | null; highlight?: string | null }
) {
  window.dispatchEvent(
    new CustomEvent<PdfViewerRequest>(PDF_VIEWER_EVENT, {
      detail: { ...pdfViewerDocument(url, title, options), placement },
    })
  );
}
