import type { AssistantAttachment, DocumentProcessingStatus } from "@prisma/client";
import { extractText } from "unpdf";
import { prisma } from "@/lib/prisma";
import { createSearchablePdf, ocrServiceConfig } from "@/lib/ocr-service";
import { deleteStoredFile, readStoredFile, uploadFile } from "@/lib/storage";
import { logger, reportException } from "@/lib/observability";
import { env } from "@/lib/env";

export const MAX_EXTRACTED_TEXT_CHARS = 250_000;
export const MAX_DOCUMENT_CHUNK_CHARS = 1_500;

/** Supported image MIME types for Gemini Vision OCR. */
const GEMINI_VISION_SUPPORTED = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

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

/**
 * Gemini Vision OCR — calls Gemini's multimodal API directly to extract text
 * from an image or scanned PDF. This is the zero-install OCR fallback that
 * works when ocrmypdf/tesseract are not available on the system.
 *
 * Returns a DocumentExtractionResult with all text on pageNumber=1.
 */
async function geminiVisionOcr(
  bytes: Uint8Array,
  mediaType: string,
  fileName: string
): Promise<DocumentExtractionResult> {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      status: "UNSUPPORTED",
      text: null,
      pageCount: null,
      error: "No OCR engine is configured. Set GEMINI_API_KEY or install ocrmypdf to enable OCR.",
      chunks: [],
    };
  }

  if (!GEMINI_VISION_SUPPORTED.has(mediaType)) {
    return {
      status: "UNSUPPORTED",
      text: null,
      pageCount: null,
      error: `File type "${mediaType}" is not supported for OCR.`,
      chunks: [],
    };
  }

  const startedAt = performance.now();
  logger.info("document.gemini_ocr.started", { mediaType, sizeBytes: bytes.byteLength, fileName });

  try {
    // Use Gemini REST API directly (no SDK dependency)
    const model = env.GEMINI_MODEL || "gemini-2.5-flash";
    const base64Data = Buffer.from(bytes).toString("base64");

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: "You are a professional document OCR and text extraction assistant. Extract ALL text from this document exactly as it appears, preserving structure, tables, headings, and line breaks. Output ONLY the extracted text with no commentary, metadata, or markdown formatting wrappers.",
                },
                {
                  inline_data: {
                    mime_type: mediaType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 8192,
          },
        }),
        signal: AbortSignal.timeout(90_000),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      logger.error("document.gemini_ocr.api_error", new Error(`Gemini API returned ${response.status}`), {
        status: response.status,
        body: errText.slice(0, 500),
      });
      throw new Error(`Gemini API returned ${response.status}: ${errText.slice(0, 200)}`);
    }

    const json = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
      error?: { message: string };
    };

    if (json.error) {
      throw new Error(`Gemini API error: ${json.error.message}`);
    }

    const rawText = json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";

    if (!rawText) {
      logger.warn("document.gemini_ocr.empty_response", {
        fileName,
        finishReason: json.candidates?.[0]?.finishReason,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return {
        status: "UNSUPPORTED",
        text: null,
        pageCount: 1,
        error: "Gemini Vision OCR found no text in this file. The file may contain only graphics.",
        chunks: [],
      };
    }

    const normalized = normalizeExtractedText(rawText).slice(0, MAX_EXTRACTED_TEXT_CHARS);
    const chunks = chunkPageText(normalized, 1);

    logger.info("document.gemini_ocr.completed", {
      fileName,
      charCount: normalized.length,
      chunkCount: chunks.length,
      durationMs: Math.round(performance.now() - startedAt),
    });

    return {
      status: "READY",
      text: normalized,
      pageCount: 1,
      error: null,
      chunks,
    };
  } catch (error) {
    reportException(error, "document.gemini_ocr.failed", {
      fileName,
      mediaType,
      sizeBytes: bytes.byteLength,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return {
      status: "FAILED",
      text: null,
      pageCount: null,
      error: "Gemini Vision OCR failed to process this file.",
      chunks: [],
    };
  }
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
        // We have a previously-generated searchable PDF — re-use it.
        const existingSearchablePdf = await readStoredFile(searchableStorageKey);
        result = await extractDocumentText(existingSearchablePdf.bytes, "application/pdf");
      } else if (ocrServiceConfig()) {
        // Try the configured OCR worker (ocrmypdf) first.
        try {
          const searchablePdf = await createSearchablePdf(bytes, document.mediaType, document.fileName);
          const ocrResult = await extractDocumentText(searchablePdf, "application/pdf");
          if (ocrResult.status === "READY") {
            result = ocrResult;
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
          } else {
            // OCR worker returned a PDF with no text — fall back to Gemini Vision.
            logger.warn("document.ocr_worker.no_text", {
              documentId: document.id,
              mediaType: document.mediaType,
            });
            result = await geminiVisionOcr(bytes, document.mediaType, document.fileName);
            if (result.status === "READY") {
              ocrEngine = "gemini-vision";
              ocrProcessedAt = new Date();
            }
          }
        } catch (ocrError) {
          // OCR worker unreachable or failed — fall back to Gemini Vision.
          reportException(ocrError, "document.ocr_worker.failed_fallback_to_gemini", {
            documentId: document.id,
          });
          result = await geminiVisionOcr(bytes, document.mediaType, document.fileName);
          if (result.status === "READY") {
            ocrEngine = "gemini-vision";
            ocrProcessedAt = new Date();
          }
        }
      } else {
        // No OCR worker configured — try Gemini Vision directly.
        result = await geminiVisionOcr(bytes, document.mediaType, document.fileName);
        if (result.status === "READY") {
          ocrEngine = "gemini-vision";
          ocrProcessedAt = new Date();
        }
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


