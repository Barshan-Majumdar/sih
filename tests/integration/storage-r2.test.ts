import { describe, expect, it } from "vitest";
import {
  deleteStoredFile,
  isDurableStorageConfigured,
  readStoredFile,
  storageFileUrl,
  uploadFile,
} from "@/lib/storage";

/**
 * The requested byte range is derived from FIRST_WORD rather than hardcoded.
 * A hardcoded range silently couples the assertion to the length of the brand
 * name, which is exactly how a rename broke this test once already.
 */
const FIRST_WORD = "Agira";
const PAYLOAD = `${FIRST_WORD} private storage`;
const LAST_BYTE = Buffer.byteLength(FIRST_WORD) - 1;

describe.skipIf(!isDurableStorageConfigured())("R2 private storage", () => {
  it("uploads, range-reads, and deletes an object through the S3 API", async () => {
    const key = `documents/storage-test/roundtrip-${Date.now()}.pdf`;
    try {
      await expect(
        uploadFile(key, Buffer.from(PAYLOAD), "application/pdf")
      ).resolves.toBe(storageFileUrl(key));

      const complete = await readStoredFile(key);
      expect(Buffer.from(complete.bytes).toString()).toBe(PAYLOAD);
      expect(complete).toMatchObject({
        contentType: "application/pdf",
        contentRange: null,
      });

      const partial = await readStoredFile(key, `bytes=0-${LAST_BYTE}`);
      expect(Buffer.from(partial.bytes).toString()).toBe(FIRST_WORD);
      expect(partial.contentRange).toMatch(new RegExp(`^bytes 0-${LAST_BYTE}/`));
    } finally {
      await deleteStoredFile(key);
    }
  });
});
