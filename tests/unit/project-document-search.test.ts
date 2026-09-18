import { describe, expect, it } from "vitest";
import {
  documentSearchTerms,
  isProjectDocumentQuestion,
  rankProjectDocumentChunks,
} from "@/lib/project-document-search";

const documents = [
  {
    id: "safety-plan",
    fileName: "Site Safety Plan.pdf",
    fileUrl: "/api/files/documents/project-1/safety.pdf",
    text: "Fall protection is required when workers are exposed to an edge six feet or more above a lower level.",
    pageCount: 12,
    pageNumber: 7,
  },
  {
    id: "door-spec",
    fileName: "Door Specifications.pdf",
    fileUrl: "/api/files/documents/project-1/doors.pdf",
    text: "Fire-rated corridor doors must provide a 90 minute rating and include smoke seals.",
    pageCount: 4,
    pageNumber: 3,
  },
];

describe("project document search", () => {
  it("recognizes questions that require document retrieval", () => {
    expect(isProjectDocumentQuestion("What does the door specification say about fire ratings?"))
      .toBe(true);
    expect(isProjectDocumentQuestion("Show the open roadblocks")).toBe(false);
  });

  it("removes generic document words from search terms", () => {
    expect(documentSearchTerms("Summarize the uploaded file about fire doors"))
      .toEqual(["fire", "doors"]);
  });

  it("ranks the supporting document and returns secure source links", () => {
    const matches = rankProjectDocumentChunks(documents, "Which specification mentions 90 minute fire doors?");
    expect(matches[0]).toMatchObject({
      documentId: "door-spec",
      fileName: "Door Specifications.pdf",
      href: "/api/files/documents/project-1/doors.pdf#page=3",
      pageCount: 4,
      pageNumber: 3,
    });
    expect(matches[0].snippet).toContain("90 minute rating");
  });

  it("searches only an explicitly named file", () => {
    const matches = rankProjectDocumentChunks(
      documents,
      'Summarize "Door Specifications.pdf" and the safety plan'
    );
    expect(matches.map((match) => match.documentId)).toEqual(["door-spec"]);
  });
});
