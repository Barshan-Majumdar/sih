import { prisma } from "@/lib/prisma";
import { privateStoredFileUrl } from "@/lib/storage";

const STOP_WORDS = new Set([
  "about",
  "attached",
  "document",
  "documents",
  "does",
  "file",
  "files",
  "find",
  "from",
  "have",
  "into",
  "project",
  "read",
  "said",
  "says",
  "search",
  "show",
  "summarize",
  "summary",
  "that",
  "the",
  "their",
  "this",
  "uploaded",
  "what",
  "where",
  "which",
  "with",
]);

export type SearchableProjectDocument = {
  id: string;
  fileName: string;
  fileUrl: string;
  text: string;
  pageCount: number | null;
  pageNumber?: number;
};

export type ProjectDocumentMatch = {
  documentId: string;
  fileName: string;
  href: string;
  snippet: string;
  pageCount: number | null;
  pageNumber: number;
  score: number;
};

export function isProjectDocumentQuestion(question: string): boolean {
  return (
    /\b(attachment|document|file|pdf|report|specification|spec|drawing|plan)\b/i.test(question) &&
    /\b(analy[sz]e|compare|contain|extract|find|inside|mention|read|review|search|say|says|summari[sz]e|what)\b/i.test(
      question
    )
  );
}

export function documentSearchTerms(query: string): string[] {
  return [
    ...new Set(
      query
        .toLocaleLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((term) => term.length > 2 && !STOP_WORDS.has(term))
    ),
  ];
}

function textChunks(text: string, maxLength = 1_100): string[] {
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxLength) {
      if (current) chunks.push(current);
      for (let start = 0; start < paragraph.length; start += maxLength - 140) {
        chunks.push(paragraph.slice(start, start + maxLength).trim());
      }
      current = "";
    } else if (!current) {
      current = paragraph;
    } else if (current.length + paragraph.length + 2 <= maxLength) {
      current += `\n\n${paragraph}`;
    } else {
      chunks.push(current);
      current = paragraph;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function rankProjectDocumentChunks(
  documents: SearchableProjectDocument[],
  query: string,
  limit = 5
): ProjectDocumentMatch[] {
  const terms = documentSearchTerms(query);
  const normalizedQuery = terms.join(" ");
  const normalizedInput = query.toLocaleLowerCase();
  const namedDocumentIds = new Set(
    documents
      .filter((document) => normalizedInput.includes(document.fileName.toLocaleLowerCase()))
      .map((document) => document.id)
  );
  const searchableDocuments = namedDocumentIds.size
    ? documents.filter((document) => namedDocumentIds.has(document.id))
    : documents;
  const candidates = searchableDocuments.flatMap((document, documentIndex) =>
    textChunks(document.text).map((snippet, chunkIndex) => {
      const searchable = `${document.fileName}\n${snippet}`.toLocaleLowerCase();
      const fileName = document.fileName.toLocaleLowerCase();
      let score = terms.length === 0 && chunkIndex === 0 ? 1 / (documentIndex + 1) : 0;
      for (const term of terms) {
        const occurrences = searchable.split(term).length - 1;
        score += Math.min(occurrences, 5);
        if (fileName.includes(term)) score += 3;
      }
      if (normalizedQuery && searchable.includes(normalizedQuery)) score += 5;
      return {
        documentId: document.id,
        fileName: document.fileName,
        href: `${privateStoredFileUrl(document.fileUrl)}#page=${document.pageNumber ?? 1}`,
        snippet,
        pageCount: document.pageCount,
        pageNumber: document.pageNumber ?? 1,
        score,
      };
    })
  );

  const selected: ProjectDocumentMatch[] = [];
  const perDocument = new Map<string, number>();
  for (const candidate of candidates.sort((left, right) => right.score - left.score)) {
    if (candidate.score <= 0 || selected.length >= limit) break;
    const count = perDocument.get(candidate.documentId) ?? 0;
    if (count >= 2) continue;
    selected.push(candidate);
    perDocument.set(candidate.documentId, count + 1);
  }
  return selected;
}

export async function searchProjectDocuments(projectId: string, query: string) {
  const chunks = await prisma.documentChunk.findMany({
    where: {
      document: {
        projectId,
        extractionStatus: "READY",
        OR: [{ source: "DIRECT_UPLOAD" }, { source: "AI_UPLOAD", messageId: { not: null } }],
      },
    },
    select: {
      pageNumber: true,
      text: true,
      document: {
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          searchableFileUrl: true,
          pageCount: true,
        },
      },
    },
    orderBy: [{ document: { createdAt: "desc" } }, { pageNumber: "asc" }, { chunkIndex: "asc" }],
    take: 1_000,
  });
  return rankProjectDocumentChunks(
    chunks.map((chunk) => ({
      id: chunk.document.id,
      fileName: chunk.document.fileName,
      fileUrl: chunk.document.searchableFileUrl ?? chunk.document.fileUrl,
      text: chunk.text,
      pageCount: chunk.document.pageCount,
      pageNumber: chunk.pageNumber,
    })),
    query
  );
}
