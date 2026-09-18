import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AssistantActionError,
  confirmAssistantAction,
  createProjectControlActionProposal,
} from "@/lib/assistant-actions";
import { createAssistantTools } from "@/lib/assistant-tools";
import { PermissionError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { cleanupFixture, createFixture, type Fixture } from "./fixtures";

describe("Assistant RFI, submittal, and document roadblock proposals", () => {
  let fixture: Fixture;

  beforeAll(async () => {
    fixture = await createFixture();
  });

  afterAll(async () => {
    await cleanupFixture(fixture);
  });

  function createConversation(userId: string) {
    return prisma.assistantConversation.create({
      data: {
        organizationId: fixture.organization.id,
        projectId: fixture.project.id,
        createdById: userId,
        title: "Assistant project-controls test",
      },
    });
  }

  function toolsFor(userId: string, conversationId: string) {
    return createAssistantTools({
      organizationId: fixture.organization.id,
      userId,
      conversationId,
      focusProjectId: fixture.project.id,
    });
  }

  it("lets a trade raise a linked RFI and confirms it exactly once", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const task = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Waterproofing mockup",
        startDate: new Date("2026-08-01T12:00:00.000Z"),
        endDate: new Date("2026-08-03T12:00:00.000Z"),
      },
    });
    const output = await toolsFor(fixture.trade.user.id, conversation.id).proposeRfiChange.execute!(
      {
        operation: "CREATE",
        question: "Which membrane termination detail should be used?",
        taskName: task.name,
        dueDate: "2026-07-30",
      },
      { toolCallId: "rfi-create", messages: [], context: {} }
    );
    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Raise RFI", status: "PENDING" },
    });
    if (!output || typeof output !== "object" || !("proposal" in output)) {
      throw new Error("Expected an RFI proposal");
    }

    const context = { organizationId: fixture.organization.id, userId: fixture.trade.user.id };
    await confirmAssistantAction(output.proposal.id, context);
    await confirmAssistantAction(output.proposal.id, context);
    expect(
      await prisma.rFI.count({
        where: {
          projectId: fixture.project.id,
          question: "Which membrane termination detail should be used?",
          taskId: task.id,
        },
      })
    ).toBe(1);
    expect(
      await prisma.activityLogEntry.count({
        where: { projectId: fixture.project.id, action: "assistant_rfi_raised" },
      })
    ).toBe(1);
  });

  it("raises an RFI from a cited project document page", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const attachment = await prisma.assistantAttachment.create({
      data: {
        projectId: fixture.project.id,
        uploadedById: fixture.trade.user.id,
        fileName: "Waterproofing Spec.pdf",
        mediaType: "application/pdf",
        sizeBytes: 2048,
        storageKey: `test/${fixture.organization.id}/waterproofing-spec.pdf`,
        fileUrl: `/api/files/test/${fixture.organization.id}/waterproofing-spec.pdf`,
        source: "DIRECT_UPLOAD",
        extractionStatus: "READY",
        pageCount: 4,
        processedAt: new Date(),
      },
    });
    await prisma.documentChunk.create({
      data: {
        documentId: attachment.id,
        pageNumber: 3,
        chunkIndex: 0,
        text: "Membrane terminations at parapets shall follow detail 7/A-501.",
      },
    });

    const output = await toolsFor(fixture.trade.user.id, conversation.id).proposeRfiChange.execute!(
      {
        operation: "CREATE",
        question: "Which membrane termination detail applies at the parapet?",
        fileName: "Waterproofing Spec.pdf",
        pageNumber: 3,
      },
      { toolCallId: "rfi-from-doc", messages: [], context: {} }
    );
    expect(output).toMatchObject({
      kind: "action-proposal",
      proposal: { actionLabel: "Raise RFI", status: "PENDING" },
    });
    if (!output || typeof output !== "object" || !("proposal" in output)) {
      throw new Error("Expected a document-linked RFI proposal");
    }
    expect(output.proposal.changes.some((change) => change.field === "document")).toBe(true);
    expect(output.proposal.changes.some((change) => change.field === "citationExcerpt")).toBe(true);

    const context = { organizationId: fixture.organization.id, userId: fixture.trade.user.id };
    await confirmAssistantAction(output.proposal.id, context);
    const rfi = await prisma.rFI.findFirstOrThrow({
      where: {
        projectId: fixture.project.id,
        question: "Which membrane termination detail applies at the parapet?",
      },
    });
    expect(rfi).toMatchObject({
      attachmentId: attachment.id,
      pageNumber: 3,
      citationExcerpt: "Membrane terminations at parapets shall follow detail 7/A-501.",
    });
  });

  it("rejects a document-linked RFI when its source file is removed before confirmation", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const attachment = await prisma.assistantAttachment.create({
      data: {
        projectId: fixture.project.id,
        uploadedById: fixture.trade.user.id,
        fileName: "Temporary Detail.pdf",
        mediaType: "application/pdf",
        sizeBytes: 1024,
        storageKey: `test/${fixture.organization.id}/temporary-detail.pdf`,
        fileUrl: `/api/files/test/${fixture.organization.id}/temporary-detail.pdf`,
        source: "DIRECT_UPLOAD",
      },
    });
    const output = await toolsFor(fixture.trade.user.id, conversation.id).proposeRfiChange.execute!(
      {
        operation: "CREATE",
        question: "Does this temporary detail still apply?",
        fileName: "Temporary Detail.pdf",
      },
      { toolCallId: "stale-rfi-document", messages: [], context: {} }
    );
    if (!output || typeof output !== "object" || !("proposal" in output)) {
      throw new Error("Expected a document-linked RFI proposal");
    }

    await prisma.assistantAttachment.delete({ where: { id: attachment.id } });
    await expect(
      confirmAssistantAction(output.proposal.id, {
        organizationId: fixture.organization.id,
        userId: fixture.trade.user.id,
      })
    ).rejects.toBeInstanceOf(AssistantActionError);
  });

  it("answers an RFI as a GC role and rejects a stale proposal", async () => {
    const conversation = await createConversation(fixture.pm.user.id);
    const rfi = await prisma.rFI.create({
      data: {
        projectId: fixture.project.id,
        question: "Confirm slab edge elevation",
        raisedById: fixture.trade.member.id,
      },
    });
    const tools = toolsFor(fixture.pm.user.id, conversation.id);
    const output = await tools.proposeRfiChange.execute!(
      {
        operation: "ANSWER",
        question: rfi.question,
        answer: "Use elevation 102.50 per sketch SK-14.",
      },
      { toolCallId: "rfi-answer", messages: [], context: {} }
    );
    if (!output || typeof output !== "object" || !("proposal" in output)) {
      throw new Error("Expected an RFI proposal");
    }
    await prisma.rFI.update({ where: { id: rfi.id }, data: { status: "CLOSED" } });
    await expect(
      confirmAssistantAction(output.proposal.id, {
        organizationId: fixture.organization.id,
        userId: fixture.pm.user.id,
      })
    ).rejects.toBeInstanceOf(AssistantActionError);
    expect(
      await prisma.assistantActionProposal.findUniqueOrThrow({ where: { id: output.proposal.id } })
    ).toMatchObject({ status: "PENDING" });
  });

  it("creates and approves a submittal through separate confirmed proposals", async () => {
    const tradeConversation = await createConversation(fixture.trade.user.id);
    const createOutput = await toolsFor(
      fixture.trade.user.id,
      tradeConversation.id
    ).proposeSubmittalChange.execute!(
      {
        operation: "CREATE",
        title: "Storefront product data",
        specSection: "08 41 13",
        dueDate: "2026-08-12",
      },
      { toolCallId: "submittal-create", messages: [], context: {} }
    );
    if (!createOutput || typeof createOutput !== "object" || !("proposal" in createOutput)) {
      throw new Error("Expected a submittal proposal");
    }
    await confirmAssistantAction(createOutput.proposal.id, {
      organizationId: fixture.organization.id,
      userId: fixture.trade.user.id,
    });

    const pmConversation = await createConversation(fixture.pm.user.id);
    const updateOutput = await toolsFor(
      fixture.pm.user.id,
      pmConversation.id
    ).proposeSubmittalChange.execute!(
      { operation: "UPDATE_STATUS", title: "Storefront product data", status: "APPROVED" },
      { toolCallId: "submittal-approve", messages: [], context: {} }
    );
    if (!updateOutput || typeof updateOutput !== "object" || !("proposal" in updateOutput)) {
      throw new Error("Expected a submittal proposal");
    }
    await confirmAssistantAction(updateOutput.proposal.id, {
      organizationId: fixture.organization.id,
      userId: fixture.pm.user.id,
    });
    expect(
      await prisma.submittal.findFirstOrThrow({
        where: { projectId: fixture.project.id, title: "Storefront product data" },
      })
    ).toMatchObject({ status: "APPROVED", specSection: "08 41 13" });
  });

  it("creates a submittal from a cited project document page", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const attachment = await prisma.assistantAttachment.create({
      data: {
        projectId: fixture.project.id,
        uploadedById: fixture.trade.user.id,
        fileName: "Storefront Product Data.pdf",
        mediaType: "application/pdf",
        sizeBytes: 3072,
        storageKey: `test/${fixture.organization.id}/storefront-product-data.pdf`,
        fileUrl: `/api/files/test/${fixture.organization.id}/storefront-product-data.pdf`,
        source: "DIRECT_UPLOAD",
        extractionStatus: "READY",
        pageCount: 5,
        processedAt: new Date(),
      },
    });
    await prisma.documentChunk.create({
      data: {
        documentId: attachment.id,
        pageNumber: 2,
        chunkIndex: 0,
        text: "Submit thermally broken storefront framing and glazing product data for review.",
      },
    });

    const output = await toolsFor(
      fixture.trade.user.id,
      conversation.id
    ).proposeSubmittalChange.execute!(
      {
        operation: "CREATE",
        title: "Storefront framing product data",
        fileName: attachment.fileName,
        pageNumber: 2,
      },
      { toolCallId: "submittal-from-doc", messages: [], context: {} }
    );
    if (!output || typeof output !== "object" || !("proposal" in output)) {
      throw new Error("Expected a document-linked submittal proposal");
    }
    expect(output.proposal.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "document", after: "Storefront Product Data.pdf, page 2" }),
        expect.objectContaining({
          field: "citationExcerpt",
          after: "Submit thermally broken storefront framing and glazing product data for review.",
        }),
      ])
    );

    await confirmAssistantAction(output.proposal.id, {
      organizationId: fixture.organization.id,
      userId: fixture.trade.user.id,
    });
    expect(
      await prisma.submittal.findFirstOrThrow({
        where: { projectId: fixture.project.id, title: "Storefront framing product data" },
      })
    ).toMatchObject({
      attachmentId: attachment.id,
      pageNumber: 2,
      citationExcerpt: "Submit thermally broken storefront framing and glazing product data for review.",
    });
  });

  it("flags a roadblock from a cited project document page", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const task = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Exterior storefront installation",
        startDate: new Date("2026-08-10T12:00:00.000Z"),
        endDate: new Date("2026-08-14T12:00:00.000Z"),
      },
    });
    const attachment = await prisma.assistantAttachment.create({
      data: {
        projectId: fixture.project.id,
        uploadedById: fixture.trade.user.id,
        fileName: "Permit Review Log.pdf",
        mediaType: "application/pdf",
        sizeBytes: 4096,
        storageKey: `test/${fixture.organization.id}/permit-review-log.pdf`,
        fileUrl: `/api/files/test/${fixture.organization.id}/permit-review-log.pdf`,
        source: "DIRECT_UPLOAD",
        extractionStatus: "READY",
        pageCount: 3,
        processedAt: new Date(),
      },
    });
    await prisma.documentChunk.create({
      data: {
        documentId: attachment.id,
        pageNumber: 1,
        chunkIndex: 0,
        text: "Storefront permit review remains open pending the revised anchorage detail.",
      },
    });

    const output = await toolsFor(
      fixture.trade.user.id,
      conversation.id
    ).proposeRoadblockChange.execute!(
      {
        taskName: task.name,
        note: "Permit approval is pending the revised anchorage detail.",
        fileName: attachment.fileName,
        pageNumber: 1,
      },
      { toolCallId: "roadblock-from-doc", messages: [], context: {} }
    );
    if (!output || typeof output !== "object" || !("proposal" in output)) {
      throw new Error("Expected a document-linked roadblock proposal");
    }
    expect(output.proposal.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "document", after: "Permit Review Log.pdf, page 1" }),
        expect.objectContaining({
          field: "citationExcerpt",
          after: "Storefront permit review remains open pending the revised anchorage detail.",
        }),
      ])
    );

    await confirmAssistantAction(output.proposal.id, {
      organizationId: fixture.organization.id,
      userId: fixture.trade.user.id,
    });
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      isRoadblock: true,
      roadblockAttachmentId: attachment.id,
      roadblockPageNumber: 1,
      roadblockCitationExcerpt: "Storefront permit review remains open pending the revised anchorage detail.",
    });
  });

  it("rejects a document roadblock when its source is removed before confirmation", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const task = await prisma.task.create({
      data: {
        projectId: fixture.project.id,
        name: "Temporary document roadblock task",
        startDate: new Date("2026-08-18T12:00:00.000Z"),
        endDate: new Date("2026-08-19T12:00:00.000Z"),
      },
    });
    const attachment = await prisma.assistantAttachment.create({
      data: {
        projectId: fixture.project.id,
        uploadedById: fixture.trade.user.id,
        fileName: "Temporary Roadblock Source.pdf",
        mediaType: "application/pdf",
        sizeBytes: 512,
        storageKey: `test/${fixture.organization.id}/temporary-roadblock-source.pdf`,
        fileUrl: `/api/files/test/${fixture.organization.id}/temporary-roadblock-source.pdf`,
        source: "DIRECT_UPLOAD",
      },
    });
    const output = await toolsFor(
      fixture.trade.user.id,
      conversation.id
    ).proposeRoadblockChange.execute!(
      {
        taskName: task.name,
        note: "Temporary source must remain available.",
        fileName: attachment.fileName,
      },
      { toolCallId: "stale-roadblock-document", messages: [], context: {} }
    );
    if (!output || typeof output !== "object" || !("proposal" in output)) {
      throw new Error("Expected a document-linked roadblock proposal");
    }

    await prisma.assistantAttachment.delete({ where: { id: attachment.id } });
    await expect(
      confirmAssistantAction(output.proposal.id, {
        organizationId: fixture.organization.id,
        userId: fixture.trade.user.id,
      })
    ).rejects.toBeInstanceOf(AssistantActionError);
    expect(await prisma.task.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
      isRoadblock: false,
      roadblockAttachmentId: null,
    });
  });

  it("enforces GC decision permissions and protects synced records", async () => {
    const conversation = await createConversation(fixture.trade.user.id);
    const native = await prisma.submittal.create({
      data: {
        projectId: fixture.project.id,
        title: "Restricted decision",
        submittedById: fixture.trade.member.id,
      },
    });
    await expect(
      createProjectControlActionProposal(
        {
          conversationId: conversation.id,
          projectId: fixture.project.id,
          entity: "SUBMITTAL",
          operation: "UPDATE",
          recordId: native.id,
          status: "APPROVED",
        },
        { organizationId: fixture.organization.id, userId: fixture.trade.user.id }
      )
    ).rejects.toBeInstanceOf(PermissionError);

    await prisma.rFI.create({
      data: {
        projectId: fixture.project.id,
        question: "Synced concrete mix question",
        raisedById: fixture.trade.member.id,
        source: "PROCORE",
        externalId: `test-${conversation.id}`,
      },
    });
    const result = await toolsFor(fixture.trade.user.id, conversation.id).proposeRfiChange.execute!(
      { operation: "CLOSE", question: "Synced concrete mix question" },
      { toolCallId: "synced-rfi", messages: [], context: {} }
    );
    expect(result).toMatchObject({ kind: "action-clarification", subject: "RFI" });
  });
});
