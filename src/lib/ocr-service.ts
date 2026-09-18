import { env } from "@/lib/env";
import { currentRequestId, logger, reportException } from "@/lib/observability";

export type OcrServiceConfig = {
  url: string;
  token: string;
  timeoutMs: number;
};

export class OcrServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OcrServiceError";
  }
}

export function ocrServiceConfig(): OcrServiceConfig | null {
  const url = env.OCR_SERVICE_URL?.trim().replace(/\/$/, "");
  const token = env.OCR_SERVICE_TOKEN?.trim();
  if (!url || !token) return null;
  return { url, token, timeoutMs: env.OCR_SERVICE_TIMEOUT_MS };
}

export async function createSearchablePdf(
  bytes: Uint8Array,
  mediaType: string,
  fileName: string,
  config = ocrServiceConfig()
): Promise<Uint8Array> {
  if (!config) {
    throw new OcrServiceError("OCR is not configured.");
  }
  let response: Response;
  const startedAt = performance.now();
  const requestId = currentRequestId() ?? crypto.randomUUID();
  logger.info("ocr.request.started", { mediaType, sizeBytes: bytes.byteLength });
  try {
    response = await fetch(`${config.url}/v1/ocr`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": mediaType,
        "X-File-Name": encodeURIComponent(fileName),
        "X-Request-ID": requestId,
      },
      body: Buffer.from(bytes),
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    reportException(error, "ocr.request.unreachable", {
      mediaType,
      sizeBytes: bytes.byteLength,
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw new OcrServiceError("The OCR worker could not be reached.");
  }
  if (!response.ok) {
    logger.error("ocr.request.rejected", new Error("OCR worker returned an error response"), {
      status: response.status,
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw new OcrServiceError(`The OCR worker rejected this file (${response.status}).`);
  }
  const result = new Uint8Array(await response.arrayBuffer());
  if (
    result.byteLength < 5 ||
    Buffer.from(result.subarray(0, 5)).toString("ascii") !== "%PDF-"
  ) {
    logger.error("ocr.request.invalid_output", new Error("OCR worker returned an invalid PDF"), {
      sizeBytes: result.byteLength,
      durationMs: Math.round(performance.now() - startedAt),
    });
    throw new OcrServiceError("The OCR worker returned an invalid PDF.");
  }
  logger.info("ocr.request.completed", {
    status: response.status,
    outputSizeBytes: result.byteLength,
    durationMs: Math.round(performance.now() - startedAt),
  });
  return result;
}
