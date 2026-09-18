UPDATE "assistant_attachment"
SET
  "extractionStatus" = 'FAILED'::"DocumentProcessingStatus",
  "extractionError" = 'Text extraction has not run for this existing file. Retry extraction from the Files workspace.'
WHERE
  "extractionStatus" = 'PENDING'::"DocumentProcessingStatus"
  AND "mediaType" = 'application/pdf';
