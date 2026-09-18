/**
 * Demo seed for Agira.
 *
 * Creates Harborview Construction with a fully populated project (schedule,
 * dependencies, weekly plan, roadblocks, RFIs, submittals, drawings, project
 * files with searchable PDF text, baselines, SIRs, field updates, activity).
 *
 * Re-running deletes the previous Harborview / legacy Acme demo data first.
 *
 * Documents in prisma/seed-assets/ are public construction PDFs — see SOURCES.md.
 */
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  PrismaClient,
  type CommitmentStatus,
  type ProjectRole,
  type RfiStatus,
  type SirStatus,
  type SubmittalStatus,
  type TaskStatus,
} from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { extractText } from "unpdf";

const prisma = new PrismaClient();

const DEMO_PASSWORD = "HarborDemo1!";
const ORG_SLUG = "harborview-construction";
const PROJECT_NAME = "Harborview Residences — Building A";
const SECOND_PROJECT_NAME = "Harborview Residences — Garage Fit-Out";

const DEMO_EMAILS = [
  "alex@harborview.demo",
  "jordan@harborview.demo",
  "morgan@harborview.demo",
  "diego@harborview.demo",
  "priya@harborview.demo",
  // Legacy seed accounts — removed on re-seed
  "jane@buildflow.dev",
  "mike@buildflow.dev",
  "sam@buildflow.dev",
  "tom@buildflow.dev",
  "sara@buildflow.dev",
] as const;

const ASSETS_DIR = path.join(process.cwd(), "prisma", "seed-assets");
const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");

function daysFrom(base: Date, days: number) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

/** Canonical Monday week start at noon UTC (matches src/lib/utils.ts). */
function weekStart(date: Date) {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

function storageFileUrl(key: string) {
  return `/api/files/${key.split("/").map(encodeURIComponent).join("/")}`;
}

function normalizeExtractedText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkPageText(text: string, pageNumber: number, maxChars = 1_500) {
  const chunks: { pageNumber: number; chunkIndex: number; text: string }[] = [];
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  let current = "";
  const push = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    chunks.push({ pageNumber, chunkIndex: chunks.length, text: normalized });
  };
  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      push(current);
      current = "";
      for (let start = 0; start < paragraph.length; start += maxChars - 180) {
        push(paragraph.slice(start, start + maxChars));
      }
    } else if (!current) {
      current = paragraph;
    } else if (current.length + paragraph.length + 2 <= maxChars) {
      current += `\n\n${paragraph}`;
    } else {
      push(current);
      current = paragraph;
    }
  }
  push(current);
  return chunks;
}

async function storeAsset(relativeKey: string, assetFileName: string) {
  const source = path.join(ASSETS_DIR, assetFileName);
  const bytes = await readFile(source);
  const dest = path.join(UPLOADS_ROOT, ...relativeKey.split("/"));
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(source, dest);
  return {
    storageKey: relativeKey,
    fileUrl: storageFileUrl(relativeKey),
    sizeBytes: bytes.length,
    contentHash: createHash("sha256").update(bytes).digest("hex"),
    bytes,
  };
}

async function extractPdfForSearch(bytes: Buffer) {
  try {
    const pdfBytes = new Uint8Array(bytes.byteLength);
    pdfBytes.set(bytes);
    const result = await extractText(pdfBytes);
    const rawPages = Array.isArray(result.text) ? result.text : [result.text];
    let remaining = 250_000;
    const pages = rawPages.map((page, index) => {
      const normalized = normalizeExtractedText(String(page ?? ""));
      const text = normalized.slice(0, Math.max(remaining, 0));
      remaining -= text.length;
      return { pageNumber: index + 1, text };
    });
    const text = pages.map((p) => p.text).filter(Boolean).join("\n\n");
    const chunks = pages.flatMap((p) => chunkPageText(p.text, p.pageNumber));
    if (!text) {
      return {
        status: "UNSUPPORTED" as const,
        text: null,
        pageCount: result.totalPages ?? pages.length,
        chunks: [] as { pageNumber: number; chunkIndex: number; text: string }[],
      };
    }
    return {
      status: "READY" as const,
      text,
      pageCount: result.totalPages ?? pages.length,
      chunks: chunks.slice(0, 400),
    };
  } catch {
    return {
      status: "FAILED" as const,
      text: null,
      pageCount: null,
      chunks: [] as { pageNumber: number; chunkIndex: number; text: string }[],
    };
  }
}

async function createUser(email: string, name: string, passwordHash: string) {
  return prisma.user.create({
    data: {
      email,
      name,
      emailVerified: true,
      accounts: {
        create: {
          providerId: "credential",
          accountId: email,
          password: passwordHash,
        },
      },
    },
  });
}

async function resetPreviousDemo() {
  const users = await prisma.user.findMany({
    where: { email: { in: [...DEMO_EMAILS] } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  const memberOrgs = userIds.length
    ? await prisma.member.findMany({
        where: { userId: { in: userIds } },
        select: { organizationId: true },
      })
    : [];
  const orgIds = new Set(memberOrgs.map((m) => m.organizationId));
  const namedOrgs = await prisma.organization.findMany({
    where: {
      OR: [{ slug: ORG_SLUG }, { slug: "acme-construction" }, { id: { in: [...orgIds] } }],
    },
    select: { id: true },
  });
  for (const org of namedOrgs) orgIds.add(org.id);

  for (const organizationId of orgIds) {
    await prisma.organization.delete({ where: { id: organizationId } }).catch(() => undefined);
  }
  if (userIds.length) {
    await prisma.assistantUsageWindow.deleteMany({
      where: { subjectId: { in: [...userIds, ...orgIds] } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
}

async function main() {
  console.log("Seeding Harborview demo data...");
  await resetPreviousDemo();

  const password = await hashPassword(DEMO_PASSWORD);
  const pm = await createUser("alex@harborview.demo", "Alex Chen", password);
  const scheduler = await createUser("jordan@harborview.demo", "Jordan Lee", password);
  const superintendent = await createUser("morgan@harborview.demo", "Morgan Blake", password);
  const electrician = await createUser("diego@harborview.demo", "Diego Ruiz", password);
  const plumber = await createUser("priya@harborview.demo", "Priya Shah", password);

  const organization = await prisma.organization.create({
    data: {
      name: "Harborview Construction LLC",
      slug: ORG_SLUG,
      // Demo org is Pro so judges get full Agent limits + integrations access.
      planTier: "PRO",
      members: {
        create: [
          { userId: pm.id, role: "owner" },
          { userId: scheduler.id, role: "member" },
          { userId: superintendent.id, role: "member" },
          { userId: electrician.id, role: "member" },
          { userId: plumber.id, role: "member" },
        ],
      },
    },
  });

  const startDate = daysFrom(new Date(), -14);
  const endDate = daysFrom(startDate, 90);

  const project = await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: PROJECT_NAME,
      startDate,
      endDate,
      members: {
        create: [
          { userId: pm.id, role: "PROJECT_MANAGER" },
          { userId: scheduler.id, role: "SCHEDULER" },
          { userId: superintendent.id, role: "SUPERINTENDENT" },
          { userId: electrician.id, role: "TRADE" },
          { userId: plumber.id, role: "TRADE" },
        ],
      },
    },
    include: { members: true },
  });

  const memberByUserId = Object.fromEntries(project.members.map((m) => [m.userId, m]));
  const pmMember = memberByUserId[pm.id]!;
  const schedulerMember = memberByUserId[scheduler.id]!;
  const superMember = memberByUserId[superintendent.id]!;
  const elecMember = memberByUserId[electrician.id]!;
  const plumbMember = memberByUserId[plumber.id]!;

  type TaskSeed = {
    key: string;
    name: string;
    assignedToId: string | null;
    start: number;
    end: number;
    status: TaskStatus;
    progress: number;
    actualStart?: number;
    actualFinish?: number;
    sequenceOrder: number;
    roadblock?: {
      note: string;
      type: "MATERIAL" | "INSPECTION" | "LABOR" | "OTHER" | "WEATHER" | "CHANGE_ORDER";
      ownerId: string;
      dueOffset: number;
      status?: "OPEN" | "RESOLVED";
    };
  };

  const taskDefs: TaskSeed[] = [
    {
      key: "mobilization",
      name: "Site mobilization & temp facilities",
      assignedToId: superMember.id,
      start: 0,
      end: 3,
      status: "DONE",
      progress: 100,
      actualStart: 0,
      actualFinish: 3,
      sequenceOrder: 10,
    },
    {
      key: "site-prep",
      name: "Site prep & excavation",
      assignedToId: pmMember.id,
      start: 2,
      end: 7,
      status: "DONE",
      progress: 100,
      actualStart: 2,
      actualFinish: 7,
      sequenceOrder: 20,
    },
    {
      key: "foundation",
      name: "Foundation & slab on grade",
      assignedToId: superMember.id,
      start: 7,
      end: 16,
      status: "DONE",
      progress: 100,
      actualStart: 7,
      actualFinish: 15,
      sequenceOrder: 30,
    },
    {
      key: "structure",
      name: "Structural framing — floors 1–3",
      assignedToId: superMember.id,
      start: 14,
      end: 28,
      status: "IN_PROGRESS",
      progress: 65,
      actualStart: 14,
      sequenceOrder: 40,
    },
    {
      key: "rough-elec",
      name: "Rough electrical wiring",
      assignedToId: elecMember.id,
      start: 22,
      end: 34,
      status: "IN_PROGRESS",
      progress: 45,
      actualStart: 22,
      sequenceOrder: 50,
    },
    {
      key: "rough-plumb",
      name: "Rough plumbing install",
      assignedToId: plumbMember.id,
      start: 22,
      end: 36,
      status: "IN_PROGRESS",
      progress: 30,
      actualStart: 22,
      sequenceOrder: 60,
      roadblock: {
        note: "Waiting on city plumbing rough-in permit approval before continuing stack work on floors 2–3.",
        type: "INSPECTION",
        ownerId: plumbMember.id,
        dueOffset: 2,
      },
    },
    {
      key: "hvac-rough",
      name: "HVAC rough-in & duct mains",
      assignedToId: superMember.id,
      start: 24,
      end: 38,
      status: "IN_PROGRESS",
      progress: 20,
      actualStart: 25,
      sequenceOrder: 70,
    },
    {
      key: "panel-insp",
      name: "Electrical panel inspection",
      assignedToId: elecMember.id,
      start: 34,
      end: 35,
      status: "DELAYED",
      progress: 10,
      actualStart: 34,
      sequenceOrder: 80,
      roadblock: {
        note: "AHJ requested revised panel clearance dimensions before inspection can be scheduled.",
        type: "INSPECTION",
        ownerId: elecMember.id,
        dueOffset: 5,
      },
    },
    {
      key: "schedule-coordination",
      name: "Three-week schedule coordination",
      assignedToId: schedulerMember.id,
      start: 26,
      end: 31,
      status: "IN_PROGRESS",
      progress: 70,
      actualStart: 26,
      sequenceOrder: 85,
    },
    {
      key: "roofing",
      name: "Roofing membrane and flashing",
      assignedToId: superMember.id,
      start: 28,
      end: 37,
      status: "IN_PROGRESS",
      progress: 35,
      actualStart: 29,
      sequenceOrder: 87,
      roadblock: {
        note: "Roof drain submittal approval is needed before the final membrane tie-in.",
        type: "MATERIAL",
        ownerId: pmMember.id,
        dueOffset: 4,
      },
    },
    {
      key: "windows",
      name: "Exterior windows and storefront",
      assignedToId: superMember.id,
      start: 30,
      end: 41,
      status: "IN_PROGRESS",
      progress: 25,
      actualStart: 31,
      sequenceOrder: 88,
    },
    {
      key: "fire-alarm-rough",
      name: "Fire alarm rough-in",
      assignedToId: elecMember.id,
      start: 31,
      end: 38,
      status: "IN_PROGRESS",
      progress: 20,
      actualStart: 32,
      sequenceOrder: 89,
    },
    {
      key: "drywall",
      name: "Drywall installation",
      assignedToId: superMember.id,
      start: 38,
      end: 48,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 90,
    },
    {
      key: "mep-inspection",
      name: "Above-ceiling MEP inspection",
      assignedToId: pmMember.id,
      start: 38,
      end: 40,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 92,
    },
    {
      key: "insulation",
      name: "Exterior wall insulation",
      assignedToId: superMember.id,
      start: 40,
      end: 46,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 94,
    },
    {
      key: "ceilings",
      name: "Ceiling grid and acoustic tile",
      assignedToId: superMember.id,
      start: 46,
      end: 54,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 96,
    },
    {
      key: "finishes",
      name: "Interior finishes & paint",
      assignedToId: pmMember.id,
      start: 48,
      end: 60,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 100,
    },
    {
      key: "electrical-trim",
      name: "Electrical devices and trim-out",
      assignedToId: elecMember.id,
      start: 52,
      end: 61,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 102,
    },
    {
      key: "plumbing-trim",
      name: "Plumbing fixtures and trim-out",
      assignedToId: plumbMember.id,
      start: 52,
      end: 62,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 104,
    },
    {
      key: "millwork",
      name: "Cabinetry and architectural millwork",
      assignedToId: superMember.id,
      start: 54,
      end: 64,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 106,
    },
    {
      key: "flooring",
      name: "Flooring installation",
      assignedToId: superMember.id,
      start: 58,
      end: 66,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 108,
    },
    {
      key: "controls",
      name: "Building controls startup",
      assignedToId: schedulerMember.id,
      start: 61,
      end: 66,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 109,
    },
    {
      key: "life-safety",
      name: "Life safety systems testing",
      assignedToId: elecMember.id,
      start: 63,
      end: 68,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 110,
    },
    {
      key: "commissioning",
      name: "MEP commissioning and functional testing",
      assignedToId: schedulerMember.id,
      start: 66,
      end: 72,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 112,
    },
    {
      key: "site-finish",
      name: "Final paving and landscaping",
      assignedToId: pmMember.id,
      start: 62,
      end: 72,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 114,
    },
    {
      key: "final-inspection",
      name: "Final building inspection",
      assignedToId: pmMember.id,
      start: 72,
      end: 74,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 116,
    },
    {
      key: "owner-training",
      name: "Owner training and turnover",
      assignedToId: superMember.id,
      start: 73,
      end: 77,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 118,
    },
    {
      key: "punch",
      name: "Punch list & closeout",
      assignedToId: pmMember.id,
      start: 74,
      end: 82,
      status: "NOT_STARTED",
      progress: 0,
      sequenceOrder: 120,
    },
  ];

  const tasksByKey: Record<string, { id: string; name: string }> = {};
  for (const def of taskDefs) {
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        name: def.name,
        assignedToId: def.assignedToId,
        startDate: daysFrom(startDate, def.start),
        endDate: daysFrom(startDate, def.end),
        actualStartDate: def.actualStart !== undefined ? daysFrom(startDate, def.actualStart) : null,
        actualFinishDate: def.actualFinish !== undefined ? daysFrom(startDate, def.actualFinish) : null,
        status: def.status,
        progress: def.progress,
        sequenceOrder: def.sequenceOrder,
        isRoadblock: Boolean(def.roadblock),
        roadblockNote: def.roadblock?.note ?? null,
        roadblockStatus: def.roadblock ? def.roadblock.status ?? "OPEN" : null,
        roadblockType: def.roadblock?.type ?? null,
        roadblockOwnerId: def.roadblock?.ownerId ?? null,
        roadblockDueDate: def.roadblock ? daysFrom(new Date(), def.roadblock.dueOffset) : null,
        roadblockRaisedBy: def.roadblock ? plumber.id : null,
      },
    });
    tasksByKey[def.key] = task;
  }

  const dependencyPairs: [string, string][] = [
    ["mobilization", "site-prep"],
    ["site-prep", "foundation"],
    ["foundation", "structure"],
    ["structure", "rough-elec"],
    ["structure", "rough-plumb"],
    ["structure", "hvac-rough"],
    ["rough-elec", "panel-insp"],
    ["structure", "roofing"],
    ["structure", "windows"],
    ["rough-elec", "fire-alarm-rough"],
    ["rough-plumb", "drywall"],
    ["rough-elec", "drywall"],
    ["hvac-rough", "drywall"],
    ["rough-plumb", "mep-inspection"],
    ["rough-elec", "mep-inspection"],
    ["hvac-rough", "mep-inspection"],
    ["mep-inspection", "ceilings"],
    ["windows", "insulation"],
    ["insulation", "drywall"],
    ["drywall", "finishes"],
    ["ceilings", "electrical-trim"],
    ["ceilings", "plumbing-trim"],
    ["drywall", "millwork"],
    ["finishes", "flooring"],
    ["electrical-trim", "life-safety"],
    ["plumbing-trim", "commissioning"],
    ["controls", "commissioning"],
    ["life-safety", "final-inspection"],
    ["commissioning", "final-inspection"],
    ["site-finish", "final-inspection"],
    ["final-inspection", "owner-training"],
    ["final-inspection", "punch"],
  ];
  for (const [pred, succ] of dependencyPairs) {
    await prisma.taskDependency.create({
      data: {
        predecessorId: tasksByKey[pred].id,
        successorId: tasksByKey[succ].id,
      },
    });
  }

  // --- Project files + drawings (public construction PDFs) ---
  // Drawing.storageKey and AssistantAttachment.storageKey are both unique, so
  // each logical file is stored under separate keys for drawings vs documents.
  const farmhouseDrawing = await storeAsset(
    `drawings/${project.id}/A100-american-farmhouse-drawings.pdf`,
    "american-farmhouse-drawings.pdf"
  );
  const nistDrawingRev1 = await storeAsset(
    `drawings/${project.id}/A000-nist-nzertf-architectural-plans-r1.pdf`,
    "nist-nzertf-architectural-plans.pdf"
  );
  const nistDrawingRev2 = await storeAsset(
    `drawings/${project.id}/A000-nist-nzertf-architectural-plans-r2.pdf`,
    "nist-nzertf-architectural-plans.pdf"
  );
  const farmhouseDocFile = await storeAsset(
    `documents/${project.id}/A100-american-farmhouse-drawings.pdf`,
    "american-farmhouse-drawings.pdf"
  );
  const nistDocFile = await storeAsset(
    `documents/${project.id}/A000-nist-nzertf-architectural-plans.pdf`,
    "nist-nzertf-architectural-plans.pdf"
  );
  const iaqSpec = await storeAsset(
    `documents/${project.id}/spec-01-81-13-nist-iaq.pdf`,
    "nist-iaq-specification.pdf"
  );

  const farmhouseExtract = await extractPdfForSearch(farmhouseDocFile.bytes);
  const nistExtract = await extractPdfForSearch(nistDocFile.bytes);
  const iaqExtract = await extractPdfForSearch(iaqSpec.bytes);

  async function createProjectDocument(opts: {
    fileName: string;
    stored: Awaited<ReturnType<typeof storeAsset>>;
    extracted: Awaited<ReturnType<typeof extractPdfForSearch>>;
  }) {
    const doc = await prisma.assistantAttachment.create({
      data: {
        projectId: project.id,
        uploadedById: pm.id,
        fileName: opts.fileName,
        mediaType: "application/pdf",
        sizeBytes: opts.stored.sizeBytes,
        contentHash: opts.stored.contentHash,
        storageKey: opts.stored.storageKey,
        fileUrl: opts.stored.fileUrl,
        source: "DIRECT_UPLOAD",
        extractionStatus: opts.extracted.status,
        extractedText: opts.extracted.text,
        pageCount: opts.extracted.pageCount,
        processedAt: opts.extracted.status === "READY" ? new Date() : null,
        extractionError:
          opts.extracted.status === "FAILED"
            ? "Seed could not extract text from this PDF."
            : opts.extracted.status === "UNSUPPORTED"
              ? "No searchable text was found in this PDF."
              : null,
      },
    });
    if (opts.extracted.chunks.length) {
      await prisma.documentChunk.createMany({
        data: opts.extracted.chunks.map((chunk) => ({
          documentId: doc.id,
          pageNumber: chunk.pageNumber,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
        })),
      });
    }
    return doc;
  }

  const farmhouseDoc = await createProjectDocument({
    fileName: "A100 American Farmhouse Drawing Set.pdf",
    stored: farmhouseDocFile,
    extracted: farmhouseExtract,
  });
  const nistDoc = await createProjectDocument({
    fileName: "A000 NIST NZERTF Architectural Plans.pdf",
    stored: nistDocFile,
    extracted: nistExtract,
  });
  const iaqDoc = await createProjectDocument({
    fileName: "Spec 01 81 13 High Performance IAQ.pdf",
    stored: iaqSpec,
    extracted: iaqExtract,
  });

  await prisma.drawing.createMany({
    data: [
      {
        projectId: project.id,
        taskId: tasksByKey["structure"].id,
        title: "A100 — Open-Source Farmhouse Drawing Set",
        discipline: "Architectural",
        fileUrl: farmhouseDrawing.fileUrl,
        storageKey: farmhouseDrawing.storageKey,
        fileName: "american-farmhouse-drawings.pdf",
        mediaType: "application/pdf",
        sizeBytes: farmhouseDrawing.sizeBytes,
        contentHash: farmhouseDrawing.contentHash,
        revision: 1,
        uploadedById: schedulerMember.id,
      },
      {
        projectId: project.id,
        taskId: tasksByKey["foundation"].id,
        title: "A000 — NIST NZERTF Architectural Plans",
        discipline: "Architectural",
        fileUrl: nistDrawingRev1.fileUrl,
        storageKey: nistDrawingRev1.storageKey,
        fileName: "nist-nzertf-architectural-plans.pdf",
        mediaType: "application/pdf",
        sizeBytes: nistDrawingRev1.sizeBytes,
        contentHash: nistDrawingRev1.contentHash,
        revision: 1,
        isSuperseded: true,
        uploadedById: schedulerMember.id,
      },
      {
        projectId: project.id,
        taskId: tasksByKey["structure"].id,
        title: "A000 — NIST NZERTF Architectural Plans",
        discipline: "Architectural",
        fileUrl: nistDrawingRev2.fileUrl,
        storageKey: nistDrawingRev2.storageKey,
        fileName: "nist-nzertf-architectural-plans.pdf",
        mediaType: "application/pdf",
        sizeBytes: nistDrawingRev2.sizeBytes,
        contentHash: nistDrawingRev2.contentHash,
        revision: 2,
        isSuperseded: false,
        uploadedById: schedulerMember.id,
      },
    ],
  });

  // Link roadblock citation to IAQ / permit-related document when possible
  await prisma.task.update({
    where: { id: tasksByKey["rough-plumb"].id },
    data: {
      roadblockAttachmentId: iaqDoc.id,
      roadblockPageNumber: 1,
      roadblockCitationExcerpt:
        "Permit and inspection coordination required before continuing rough plumbing on upper floors.",
      roadblockRaisedBy: plumber.id,
    },
  });

  // --- Weekly commitments (current + prior weeks for PPC) ---
  const thisWeek = weekStart(new Date());
  const lastWeek = weekStart(daysFrom(new Date(), -7));
  const nextWeek = weekStart(daysFrom(new Date(), 7));

  type CommitmentSeed = {
    taskKey: string;
    week: Date;
    by: string;
    status: CommitmentStatus;
    reason?: string;
  };
  const commitments: CommitmentSeed[] = [
    {
      taskKey: "structure",
      week: lastWeek,
      by: superMember.id,
      status: "COMPLETED",
    },
    {
      taskKey: "rough-elec",
      week: lastWeek,
      by: elecMember.id,
      status: "NOT_COMPLETED",
      reason: "Panel feeders delayed by supplier — partial rough only.",
    },
    {
      taskKey: "rough-plumb",
      week: lastWeek,
      by: plumbMember.id,
      status: "NOT_COMPLETED",
      reason: "City permit not released; stack work paused.",
    },
    {
      taskKey: "rough-elec",
      week: thisWeek,
      by: elecMember.id,
      status: "COMMITTED",
    },
    {
      taskKey: "hvac-rough",
      week: thisWeek,
      by: superMember.id,
      status: "COMMITTED",
    },
    {
      taskKey: "structure",
      week: thisWeek,
      by: superMember.id,
      status: "COMMITTED",
    },
    {
      taskKey: "rough-plumb",
      week: nextWeek,
      by: plumbMember.id,
      status: "COMMITTED",
    },
    {
      taskKey: "panel-insp",
      week: nextWeek,
      by: elecMember.id,
      status: "COMMITTED",
    },
  ];
  for (const c of commitments) {
    await prisma.weeklyCommitment.create({
      data: {
        taskId: tasksByKey[c.taskKey].id,
        weekStartDate: c.week,
        committedById: c.by,
        status: c.status,
        reasonForVariance: c.reason ?? null,
      },
    });
  }

  // --- RFIs ---
  await prisma.rFI.createMany({
    data: [
      {
        projectId: project.id,
        taskId: tasksByKey["panel-insp"].id,
        attachmentId: nistDoc.id,
        pageNumber: 1,
        citationExcerpt: "Confirm required working clearances at main distribution panel.",
        question:
          "Confirm required working clearances at the main electrical panel per the architectural plans — does SK-E12 supersede the NZERTF clearance note?",
        answer:
          "Use SK-E12. Maintain 36 in clear working space in front of the panel; dimension to be verified on site before re-inspection.",
        status: "ANSWERED" as RfiStatus,
        dueDate: daysFrom(new Date(), -2),
        raisedById: elecMember.id,
      },
      {
        projectId: project.id,
        taskId: tasksByKey["rough-plumb"].id,
        attachmentId: iaqDoc.id,
        pageNumber: 2,
        citationExcerpt: "Sustainability and IAQ requirements for residential new construction.",
        question:
          "Does Spec 01 81 13 require low-VOC sealants at all wet-wall penetrations before covering rough plumbing?",
        status: "OPEN" as RfiStatus,
        dueDate: daysFrom(new Date(), 4),
        raisedById: plumbMember.id,
      },
      {
        projectId: project.id,
        taskId: tasksByKey["structure"].id,
        attachmentId: farmhouseDoc.id,
        pageNumber: 1,
        citationExcerpt: "Open-source architectural drawing set — foundation and framing references.",
        question: "Confirm beam pocket dimensions at grid B/3 against the farmhouse foundation detail sheet.",
        answer: "Approved as drawn on A1.0 foundation plan. No change.",
        status: "CLOSED" as RfiStatus,
        dueDate: daysFrom(new Date(), -10),
        raisedById: superMember.id,
      },
    ],
  });

  // --- Submittals ---
  await prisma.submittal.createMany({
    data: [
      {
        projectId: project.id,
        taskId: tasksByKey["rough-elec"].id,
        attachmentId: nistDoc.id,
        pageNumber: 1,
        citationExcerpt: "Electrical distribution equipment referenced in architectural set.",
        title: "Level 2 light fixtures — product data",
        specSection: "26 51 00",
        status: "PENDING" as SubmittalStatus,
        dueDate: daysFrom(new Date(), 6),
        submittedById: elecMember.id,
      },
      {
        projectId: project.id,
        taskId: tasksByKey["hvac-rough"].id,
        title: "AHU-1 schedule & performance data",
        specSection: "23 74 00",
        status: "APPROVED" as SubmittalStatus,
        dueDate: daysFrom(new Date(), -5),
        submittedById: superMember.id,
      },
      {
        projectId: project.id,
        taskId: tasksByKey["rough-plumb"].id,
        attachmentId: iaqDoc.id,
        pageNumber: 3,
        title: "Low-VOC sealant product data (wet walls)",
        specSection: "07 92 00",
        status: "REVISE_RESUBMIT" as SubmittalStatus,
        dueDate: daysFrom(new Date(), 3),
        submittedById: plumbMember.id,
      },
      {
        projectId: project.id,
        taskId: tasksByKey["finishes"].id,
        title: "Interior paint color schedule",
        specSection: "09 91 00",
        status: "REJECTED" as SubmittalStatus,
        dueDate: daysFrom(new Date(), -1),
        submittedById: pmMember.id,
      },
    ],
  });

  // --- Schedule impact requests ---
  await prisma.scheduleImpactRequest.createMany({
    data: [
      {
        projectId: project.id,
        taskId: tasksByKey["panel-insp"].id,
        description:
          "AHJ panel clearance revision may delay Electrical panel inspection by 3–5 days and push drywall start.",
        proposedNewEndDate: daysFrom(startDate, 40),
        status: "PENDING" as SirStatus,
        submittedById: elecMember.id,
      },
      {
        projectId: project.id,
        taskId: tasksByKey["rough-plumb"].id,
        description: "City permit lag on rough plumbing — propose new finish for Rough plumbing install.",
        proposedNewEndDate: daysFrom(startDate, 42),
        status: "APPROVED" as SirStatus,
        submittedById: plumbMember.id,
        reviewedById: pmMember.id,
        reviewNote: "Approved — reflow drywall after permit release; watch critical path weekly.",
        reviewedAt: daysFrom(new Date(), -1),
      },
      {
        projectId: project.id,
        taskId: tasksByKey["hvac-rough"].id,
        description: "Request to advance HVAC rough by overlapping with framing punch — rejected for safety.",
        proposedNewEndDate: daysFrom(startDate, 32),
        status: "REJECTED" as SirStatus,
        submittedById: superMember.id,
        reviewedById: pmMember.id,
        reviewNote: "Keep sequence — no overlap with incomplete framing drop zones.",
        reviewedAt: daysFrom(new Date(), -3),
      },
    ],
  });

  // --- Baseline ---
  const baseline = await prisma.baseline.create({
    data: {
      projectId: project.id,
      name: "Owner-approved baseline",
      createdById: schedulerMember.id,
      snapshots: {
        create: Object.values(tasksByKey).map((task) => {
          const def = taskDefs.find((t) => t.name === task.name)!;
          return {
            taskId: task.id,
            taskName: task.name,
            startDate: daysFrom(startDate, def.start),
            endDate: daysFrom(startDate, def.end),
            status: def.status,
          };
        }),
      },
    },
  });

  // --- Field updates ---
  await prisma.taskUpdate.createMany({
    data: [
      {
        taskId: tasksByKey["structure"].id,
        authorId: superintendent.id,
        note: "Floor 2 framing complete; starting floor 3 sheathing tomorrow AM.",
      },
      {
        taskId: tasksByKey["rough-elec"].id,
        authorId: electrician.id,
        note: "Homes A–C rough complete on floor 1. Waiting on panel clearance answer before floor 2 feeders.",
      },
      {
        taskId: tasksByKey["rough-plumb"].id,
        authorId: plumber.id,
        note: "Stacks stubbed to floor 2. Permit still OPEN — crew reassigned to garage fit-out temporarily.",
      },
    ],
  });

  // --- Activity log ---
  await prisma.activityLogEntry.createMany({
    data: [
      {
        projectId: project.id,
        userId: pm.id,
        action: "project_created",
        detail: `Created project "${PROJECT_NAME}"`,
        entityType: "project",
        entityId: project.id,
        source: "SYSTEM",
      },
      {
        projectId: project.id,
        taskId: tasksByKey["rough-plumb"].id,
        taskName: tasksByKey["rough-plumb"].name,
        userId: plumber.id,
        action: "roadblock_raised",
        detail: "City plumbing rough-in permit pending",
        entityType: "task",
        entityId: tasksByKey["rough-plumb"].id,
        source: "UI",
      },
      {
        projectId: project.id,
        userId: scheduler.id,
        action: "baseline_created",
        detail: `Baseline "${baseline.name}" captured`,
        entityType: "baseline",
        entityId: baseline.id,
        source: "UI",
      },
      {
        projectId: project.id,
        userId: pm.id,
        action: "document_uploaded",
        detail: `Uploaded ${iaqDoc.fileName}`,
        entityType: "document",
        entityId: iaqDoc.id,
        source: "UI",
      },
      {
        projectId: project.id,
        userId: electrician.id,
        action: "rfi_raised",
        detail: "Panel clearance RFI submitted",
        entityType: "rfi",
        source: "UI",
      },
    ],
  });

  // --- Agent conversation (completes onboarding "Ask Agent" signal) ---
  const conversation = await prisma.assistantConversation.create({
    data: {
      organizationId: organization.id,
      projectId: project.id,
      createdById: pm.id,
      title: "What is threatening Building A completion?",
      messages: {
        create: [
          {
            role: "USER",
            content: "What is threatening this project's completion date?",
            completedAt: new Date(),
            durationMs: 12,
          },
          {
            role: "ASSISTANT",
            content:
              "Two open inspection constraints sit on the critical path: Rough plumbing install is waiting on the city permit, and Electrical panel inspection is delayed pending clearance confirmation. Both can push Drywall installation and later finishes if they slip further. Review the open RFIs, pending SIR on the panel, and this week's commitments for electrical and HVAC rough-in.",
            model: "openrouter/free",
            completedAt: new Date(),
            durationMs: 1800,
          },
        ],
      },
    },
  });

  // --- Second project for portfolio analytics ---
  const garageStart = daysFrom(new Date(), -7);
  const garage = await prisma.project.create({
    data: {
      organizationId: organization.id,
      name: SECOND_PROJECT_NAME,
      startDate: garageStart,
      endDate: daysFrom(garageStart, 45),
      members: {
        create: [
          { userId: pm.id, role: "PROJECT_MANAGER" as ProjectRole },
          { userId: superintendent.id, role: "SUPERINTENDENT" as ProjectRole },
          { userId: electrician.id, role: "TRADE" as ProjectRole },
        ],
      },
    },
    include: { members: true },
  });
  const garagePm = garage.members.find((m) => m.userId === pm.id)!;
  const garageSuper = garage.members.find((m) => m.userId === superintendent.id)!;
  const garageElec = garage.members.find((m) => m.userId === electrician.id)!;

  const garageDemo = await prisma.task.create({
    data: {
      projectId: garage.id,
      name: "Garage slab demo & haul-off",
      assignedToId: garageSuper.id,
      startDate: daysFrom(garageStart, 0),
      endDate: daysFrom(garageStart, 5),
      status: "DONE",
      progress: 100,
      actualStartDate: daysFrom(garageStart, 0),
      actualFinishDate: daysFrom(garageStart, 4),
      sequenceOrder: 10,
    },
  });
  const garageElecTask = await prisma.task.create({
    data: {
      projectId: garage.id,
      name: "Garage EV charger rough-in",
      assignedToId: garageElec.id,
      startDate: daysFrom(garageStart, 5),
      endDate: daysFrom(garageStart, 12),
      status: "IN_PROGRESS",
      progress: 50,
      actualStartDate: daysFrom(garageStart, 5),
      sequenceOrder: 20,
    },
  });
  await prisma.taskDependency.create({
    data: { predecessorId: garageDemo.id, successorId: garageElecTask.id },
  });
  await prisma.weeklyCommitment.create({
    data: {
      taskId: garageElecTask.id,
      weekStartDate: thisWeek,
      committedById: garageElec.id,
      status: "COMMITTED",
    },
  });
  await prisma.activityLogEntry.create({
    data: {
      projectId: garage.id,
      userId: pm.id,
      action: "project_created",
      detail: `Created project "${SECOND_PROJECT_NAME}"`,
      entityType: "project",
      entityId: garage.id,
      source: "SYSTEM",
    },
  });
  void garagePm;

  console.log("\nSeed complete!\n");
  console.log("Organization: %s", organization.name);
  console.log("Primary project: %s", PROJECT_NAME);
  console.log("Portfolio project: %s", SECOND_PROJECT_NAME);
  console.log("Org plan:         PRO (full Agent limits + integrations)");
  console.log("Agent conversation: %s", conversation.title);
  console.log("Project files: %s, %s, %s", farmhouseDoc.fileName, nistDoc.fileName, iaqDoc.fileName);
  console.log("\nDemo accounts (password: %s):", DEMO_PASSWORD);
  console.log("  Project Manager:  alex@harborview.demo");
  console.log("  Scheduler:        jordan@harborview.demo");
  console.log("  Superintendent:   morgan@harborview.demo");
  console.log("  Trade (elec):     diego@harborview.demo");
  console.log("  Trade (plumb):    priya@harborview.demo");
  console.log("\nDocument sources: prisma/seed-assets/SOURCES.md");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
