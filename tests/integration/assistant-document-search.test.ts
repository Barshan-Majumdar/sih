import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAssistantTools } from "@/lib/assistant-tools";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

describe("Assistant project document retrieval", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  it("returns extracted snippets with a secure clickable source", async () => {
    const conversation = await prisma.assistantConversation.create({
      data: {
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        createdById: fixture.trade.user.id,
        title: "Document search test",
      },
    });
    const document = await prisma.assistantAttachment.create({
      data: {
        projectId: fixture.project.id,
        uploadedById: fixture.pm.user.id,
        fileName: "Door Specifications.pdf",
        mediaType: "application/pdf",
        sizeBytes: 512,
        storageKey: `documents/${fixture.project.id}/files/door-specifications.pdf`,
        fileUrl: `/api/files/documents/${fixture.project.id}/files/door-specifications.pdf`,
        searchableStorageKey: `documents/${fixture.project.id}/files/door-specifications.searchable.pdf`,
        searchableFileUrl: `/api/files/documents/${fixture.project.id}/files/door-specifications.searchable.pdf`,
        ocrEngine: "ocrmypdf",
        ocrProcessedAt: new Date(),
        source: "DIRECT_UPLOAD",
        extractionStatus: "READY",
        extractedText: "Fire-rated corridor doors require a 90 minute rating and smoke seals.",
        pageCount: 4,
        processedAt: new Date(),
      },
    });
    await prisma.documentChunk.create({
      data: {
        documentId: document.id,
        pageNumber: 3,
        chunkIndex: 0,
        text: "Fire-rated corridor doors require a 90 minute rating and smoke seals.",
      },
    });
    const tool = createAssistantTools({
      organizationId: fixture.organization.id,
      userId: fixture.trade.user.id,
      conversationId: conversation.id,
      focusProjectId: fixture.project.id,
    }).searchProjectDocuments;

    const output = await tool.execute!(
      { query: "What does the door specification say about fire ratings?" },
      { toolCallId: "document-search", messages: [], context: {} }
    );
    expect(output).toMatchObject({
      kind: "document-search",
      matches: [
        {
          fileName: "Door Specifications.pdf",
          snippet: {
            quotedText: expect.stringContaining("90 minute rating"),
            evidenceType: "untrusted-document-excerpt",
            containsInstructionLikeText: false,
          },
          pageCount: 4,
          pageNumber: 3,
        },
      ],
      sources: [
        {
          label: "Door Specifications.pdf - Page 3",
          href: `/api/files/documents/${fixture.project.id}/files/door-specifications.searchable.pdf#page=3`,
          highlight: expect.stringContaining("90 minute rating"),
        },
      ],
    });
  });
});
