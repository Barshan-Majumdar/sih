import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";
import {
  assistantFileParts,
  buildAttachmentAcknowledgement,
  formatAttachmentBytes,
  isAllowedAssistantAttachmentType,
} from "@/lib/assistant-attachments";

describe("assistant attachments", () => {
  it("accepts supported project document and image types", () => {
    expect(isAllowedAssistantAttachmentType("application/pdf")).toBe(true);
    expect(isAllowedAssistantAttachmentType("image/png")).toBe(true);
    expect(isAllowedAssistantAttachmentType("image/svg+xml")).toBe(false);
    expect(isAllowedAssistantAttachmentType("text/plain")).toBe(false);
  });

  it("extracts only file parts from a UI message", () => {
    const message: UIMessage = {
      id: "message-1",
      role: "user",
      parts: [
        { type: "text", text: "Review this plan" },
        {
          type: "file",
          filename: "A-101.pdf",
          mediaType: "application/pdf",
          url: "/api/files/documents/project-1/A-101.pdf",
        },
      ],
    };

    expect(assistantFileParts(message)).toEqual([message.parts[1]]);
  });

  it("formats compact attachment sizes", () => {
    expect(formatAttachmentBytes(512)).toBe("1 KB");
    expect(formatAttachmentBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("confirms stored files without relying on the language model", () => {
    expect(
      buildAttachmentAcknowledgement(
        "Save this file with this project and confirm the attachment name.",
        ["report.pdf"],
        "Riverside Apartments"
      )
    ).toBe(
      '"report.pdf" is saved securely to Riverside Apartments and attached to this conversation. Its attachment name is "report.pdf".'
    );
  });

  it("routes content questions to document retrieval", () => {
    expect(
      buildAttachmentAcknowledgement(
        "Summarize this document",
        ["report.pdf"],
        "Riverside Apartments"
      )
    ).toBeNull();
  });
});
