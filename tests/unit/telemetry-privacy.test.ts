import { describe, expect, it } from "vitest";
import { redactText, sanitizeMetadata } from "@/lib/telemetry-privacy";

describe("telemetry privacy", () => {
  it("redacts credentials, database URLs, and email addresses", () => {
    const value = redactText(
      "Bearer secret-token postgres://user:pass@db.example.com/app user@example.com"
    );

    expect(value).not.toContain("secret-token");
    expect(value).not.toContain("user:pass");
    expect(value).not.toContain("user@example.com");
  });

  it("removes sensitive fields while preserving operational identifiers", () => {
    expect(
      sanitizeMetadata({
        projectId: "project_123",
        requestId: "request_123",
        authorization: "Bearer secret",
        prompt: "private project question",
        nested: { accessToken: "secret", status: 500 },
      })
    ).toEqual({
      projectId: "project_123",
      requestId: "request_123",
      authorization: "[REDACTED]",
      prompt: "[REDACTED]",
      nested: { accessToken: "[REDACTED]", status: 500 },
    });
  });
});
