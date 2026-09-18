import type { RfiStatus, SubmittalStatus } from "@prisma/client";
import type { ProcoreRfi, ProcoreSubmittal } from "@/lib/procore";

/** Map a Procore RFI status string to our native enum. */
export function mapProcoreRfiStatus(status: string | null | undefined, hasAnswer: boolean): RfiStatus {
  const normalized = (status ?? "").toLowerCase();
  if (normalized.includes("closed") || normalized.includes("void")) return "CLOSED";
  if (hasAnswer || normalized.includes("answer")) return "ANSWERED";
  return "OPEN";
}

/** Map a Procore submittal status to our native enum. */
export function mapProcoreSubmittalStatus(status: unknown): SubmittalStatus {
  const name =
    typeof status === "string"
      ? status
      : status && typeof status === "object" && "name" in status
        ? String((status as { name?: string }).name ?? "")
        : "";
  const normalized = name.toLowerCase();
  if (normalized.includes("approve")) return "APPROVED";
  if (normalized.includes("reject") && !normalized.includes("resubmit")) return "REJECTED";
  if (normalized.includes("revise") || normalized.includes("resubmit")) return "REVISE_RESUBMIT";
  return "PENDING";
}

export function procoreRfiQuestion(rfi: ProcoreRfi): string {
  const subject = rfi.subject?.trim();
  const question = rfi.question?.trim();
  if (subject && question && subject !== question) return `${subject}: ${question}`;
  return subject || question || `Procore RFI #${rfi.id}`;
}

export function procoreRfiAnswer(rfi: ProcoreRfi): string | null {
  const answers = rfi.answers ?? [];
  const text = answers
    .map((a) => a.answer?.trim())
    .filter(Boolean)
    .join("\n\n");
  return text || null;
}

export function procoreSubmittalTitle(submittal: ProcoreSubmittal): string {
  const title = submittal.title?.trim();
  if (title) return title;
  if (submittal.number) return `Submittal ${submittal.number}`;
  return `Procore Submittal #${submittal.id}`;
}

export function procoreSubmittalSpecSection(submittal: ProcoreSubmittal): string | null {
  const section = submittal.specification_section;
  if (!section) return null;
  const number = section.number?.trim();
  const description = section.description?.trim();
  if (number && description) return `${number} — ${description}`;
  return number || description || null;
}

export function parseProcoreDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
