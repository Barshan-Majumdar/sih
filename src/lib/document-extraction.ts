import type { AssistantAttachment, DocumentProcessingStatus } from "@prisma/client";
import { extractText } from "unpdf";
import { prisma } from "@/lib/prisma";
import { createSearchablePdf, ocrServiceConfig } from "@/lib/ocr-service";
import { deleteStoredFile, readStoredFile, uploadFile } from "@/lib/storage";
import { logger, reportException } from "@/lib/observability";

export const MAX_EXTRACTED_TEXT_CHARS = 250_000;
export const MAX_DOCUMENT_CHUNK_CHARS = 1_500;

export type ExtractedDocumentChunk = {
  pageNumber: number;
  chunkIndex: number;
  text: string;
};

export type DocumentExtractionResult = {
  status: DocumentProcessingStatus;
  text: string | null;
  pageCount: number | null;
  error: string | null;
  chunks: ExtractedDocumentChunk[];
};

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkPageText(text: string, pageNumber: number): ExtractedDocumentChunk[] {
  const chunks: ExtractedDocumentChunk[] = [];
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  let current = "";
  const push = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    chunks.push({ pageNumber, chunkIndex: chunks.length, text: normalized });
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length > MAX_DOCUMENT_CHUNK_CHARS) {
      push(current);
      current = "";
      for (let start = 0; start < paragraph.length; start += MAX_DOCUMENT_CHUNK_CHARS - 180) {
        push(paragraph.slice(start, start + MAX_DOCUMENT_CHUNK_CHARS));
      }
    } else if (!current) {
      current = paragraph;
    } else if (current.length + paragraph.length + 2 <= MAX_DOCUMENT_CHUNK_CHARS) {
      current += `\n\n${paragraph}`;
    } else {
      push(current);
      current = paragraph;
    }
  }
  push(current);
  return chunks;
}

export async function extractDocumentText(
  bytes: Uint8Array,
  mediaType: string
): Promise<DocumentExtractionResult> {
  if (mediaType !== "application/pdf") {
    return {
      status: "UNSUPPORTED",
      text: null,
      pageCount: null,
      error: "This image needs OCR before its text can be searched.",
      chunks: [],
    };
  }

  try {
    const pdfBytes = new Uint8Array(bytes.byteLength);
    pdfBytes.set(bytes);
    const result = await extractText(pdfBytes);
    const rawPages = Array.isArray(result.text) ? result.text : [result.text];
    let remainingCharacters = MAX_EXTRACTED_TEXT_CHARS;
    const pages = rawPages.map((page, index) => {
      const normalized = normalizeExtractedText(page);
      const text = normalized.slice(0, Math.max(remainingCharacters, 0));
      remainingCharacters -= text.length;
      return { pageNumber: index + 1, text };
    });
    const text = pages.map((page) => page.text).filter(Boolean).join("\n\n");
    const chunks = pages.flatMap((page) => chunkPageText(page.text, page.pageNumber));
    if (!text) {
      return {
        status: "UNSUPPORTED",
        text: null,
        pageCount: result.totalPages,
        error: "No searchable text was found. This PDF may need OCR.",
        chunks: [],
      };
    }
    return {
      status: "READY",
      text,
      pageCount: result.totalPages,
      error: null,
      chunks,
    };
  } catch (error) {
    reportException(error, "document.extraction.failed", { mediaType, sizeBytes: bytes.byteLength });
    return {
      status: "FAILED",
      text: null,
      pageCount: null,
      error: "Agira could not extract text from this PDF.",
      chunks: [],
    };
  }
}

export async function processProjectDocument(
  document: Pick<
    AssistantAttachment,
    | "id"
    | "projectId"
    | "fileName"
    | "storageKey"
    | "mediaType"
    | "searchableStorageKey"
    | "searchableFileUrl"
    | "ocrEngine"
    | "ocrProcessedAt"
  >,
  providedBytes?: Uint8Array
): Promise<AssistantAttachment> {
  const startedAt = performance.now();
  logger.info("document.processing.started", {
    documentId: document.id,
    projectId: document.projectId,
    mediaType: document.mediaType,
  });
  await prisma.assistantAttachment.update({
    where: { id: document.id },
    data: {
      extractionStatus: "PROCESSING",
      extractionError: null,
    },
  });

  let uploadedSearchableKey: string | null = null;
  try {
    const bytes = providedBytes ?? (await readStoredFile(document.storageKey)).bytes;
    let result = await extractDocumentText(bytes, document.mediaType);
    let searchableStorageKey = document.searchableStorageKey;
    let searchableFileUrl = document.searchableFileUrl;
    let ocrEngine = document.ocrEngine;
    let ocrProcessedAt = document.ocrProcessedAt;

    if (result.status === "UNSUPPORTED") {
      if (searchableStorageKey) {
        const existingSearchablePdf = await readStoredFile(searchableStorageKey);
        result = await extractDocumentText(existingSearchablePdf.bytes, "application/pdf");
      } else if (!ocrServiceConfig()) {
        result = {
          ...result,
          error: "No searchable text was found. Configure the free OCR worker to process scanned PDFs and images.",
        };
      } else {
        const searchablePdf = await createSearchablePdf(bytes, document.mediaType, document.fileName);
        result = await extractDocumentText(searchablePdf, "application/pdf");
        if (result.status !== "READY") {
          throw new Error("OCR output did not contain searchable text");
        }
        searchableStorageKey =
          document.searchableStorageKey ?? `${document.storageKey}.searchable.pdf`;
        searchableFileUrl = await uploadFile(
          searchableStorageKey,
          Buffer.from(searchablePdf),
          "application/pdf"
        );
        uploadedSearchableKey = searchableStorageKey;
        ocrEngine = "ocrmypdf";
        ocrProcessedAt = new Date();
      }
    }
    const processed = await prisma.$transaction(async (transaction) => {
      await transaction.documentChunk.deleteMany({ where: { documentId: document.id } });
      if (result.chunks.length > 0) {
        await transaction.documentChunk.createMany({
          data: result.chunks.map((chunk) => ({ ...chunk, documentId: document.id })),
        });
      }
      return transaction.assistantAttachment.update({
        where: { id: document.id },
        data: {
          extractionStatus: result.status,
          extractedText: result.text,
          extractionError: result.error,
          pageCount: result.pageCount,
          processedAt: new Date(),
          searchableStorageKey,
          searchableFileUrl,
          ocrEngine,
          ocrProcessedAt,
        },
      });
    });
    logger.info("document.processing.completed", {
      documentId: document.id,
      projectId: document.projectId,
      status: processed.extractionStatus,
      pageCount: processed.pageCount,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return processed;
  } catch (error) {
    reportException(error, "document.processing.failed", {
      documentId: document.id,
      projectId: document.projectId,
      mediaType: document.mediaType,
      durationMs: Math.round(performance.now() - startedAt),
    });
    if (uploadedSearchableKey) {
      await deleteStoredFile(uploadedSearchableKey).catch(() => undefined);
    }
    return prisma.$transaction(async (transaction) => {
      await transaction.documentChunk.deleteMany({ where: { documentId: document.id } });
      return transaction.assistantAttachment.update({
        where: { id: document.id },
        data: {
          extractionStatus: "FAILED",
          extractedText: null,
          extractionError: "Agira could not access, extract, or OCR this file.",
          pageCount: null,
          processedAt: new Date(),
        },
      });
    });
  }
}
