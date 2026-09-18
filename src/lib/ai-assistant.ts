import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { formatDate, TASK_STATUS_LABELS, ROADBLOCK_TYPE_LABELS } from "@/lib/utils";
import { computePpcTrend } from "@/lib/analytics";
import { loadProjectSummary } from "@/lib/project-summary";
import { stripAssistantMarkdown } from "@/lib/assistant-plain-text";
import { withProviderFallback } from "@/lib/ai-provider";
import { requireOrganizationMember } from "@/lib/permissions";

export { AssistantNotConfiguredError } from "@/lib/ai-provider";

export type AssistantMessage = { role: "user" | "assistant"; content: string };

async function buildProjectContext(projectId: string, userId: string): Promise<string> {
  const [project, tasks, openRoadblocks, recentCommitments, openSubmittals, openRfis] = await Promise.all([
    prisma.project.findFirstOrThrow({
      where: { id: projectId, isArchived: false, members: { some: { userId } } },
    }),
    prisma.task.findMany({
      where: { projectId },
      include: { assignedTo: { include: { user: { select: { name: true } } } } },
      orderBy: { startDate: "asc" },
      take: 100,
    }),
    prisma.task.findMany({
      where: { projectId, isRoadblock: true, roadblockStatus: "OPEN" },
      include: { roadblockOwner: { include: { user: { select: { name: true } } } } },
      take: 30,
    }),
    prisma.weeklyCommitment.findMany({
      where: { removedAt: null, task: { projectId } },
      orderBy: { weekStartDate: "desc" },
      take: 60,
    }),
    prisma.submittal.findMany({ where: { projectId, status: { not: "APPROVED" } }, take: 30 }),
    prisma.rFI.findMany({ where: { projectId, status: { not: "CLOSED" } }, take: 30 }),
  ]);

  const ppcTrend = computePpcTrend(recentCommitments);
  const latestPpc = ppcTrend[ppcTrend.length - 1];
  const taskLines = tasks
    .map(
      (task) =>
        `- "${task.name}" [${TASK_STATUS_LABELS[task.status]}] ${formatDate(task.startDate)}-${formatDate(task.endDate)}, assigned to ${task.assignedTo?.user.name ?? "unassigned"}${task.isRoadblock ? ` - ROADBLOCK: ${task.roadblockNote ?? ""}` : ""}`
    )
    .join("\n");
  const roadblockLines = openRoadblocks
    .map(
      (task) =>
        `- "${task.name}": ${task.roadblockNote ?? "(no note)"} [type: ${task.roadblockType ? ROADBLOCK_TYPE_LABELS[task.roadblockType] : "n/a"}, owner: ${task.roadblockOwner?.user.name ?? "unassigned"}, due: ${task.roadblockDueDate ? formatDate(task.roadblockDueDate) : "n/a"}]`
    )
    .join("\n");
  const submittalLines = openSubmittals
    .map((item) => `- "${item.title}" [${item.status}]${item.dueDate ? `, due ${formatDate(item.dueDate)}` : ""}`)
    .join("\n");
  const rfiLines = openRfis
    .map((item) => `- "${item.question}" [${item.status}]${item.dueDate ? `, due ${formatDate(item.dueDate)}` : ""}`)
    .join("\n");

  return `PROJECT: ${project.name} (${formatDate(project.startDate)} to ${formatDate(project.endDate)})

Most recent weekly PPC: ${latestPpc ? `${latestPpc.ppc}% (week of ${formatDate(latestPpc.weekStart)})` : "no commitments recorded yet"}

TASKS (${tasks.length} total):
${taskLines || "(none)"}

OPEN ROADBLOCKS (${openRoadblocks.length}):
${roadblockLines || "(none)"}

OPEN SUBMITTALS (${openSubmittals.length}):
${submittalLines || "(none)"}

OPEN RFIS (${openRfis.length}):
${rfiLines || "(none)"}`;
}

export async function buildAssistantContext(
  organizationId: string,
  userId: string,
  focusProjectId?: string
): Promise<string> {
  await requireOrganizationMember(userId, organizationId);
  const [organization, projects] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: organizationId } }),
    prisma.project.findMany({
      where: { organizationId, isArchived: false, members: { some: { userId } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const summaries = await Promise.all(
    projects.map(async (project) => ({ project, summary: await loadProjectSummary(project.id) }))
  );
  const portfolioLines = summaries
    .map(({ project, summary }, index) => {
      const variance =
        summary.variance === null
          ? "variance n/a"
          : summary.variance <= 0
            ? summary.variance === 0
              ? "on track"
              : `${Math.abs(summary.variance)}d ahead`
            : `${summary.variance}d behind`;
      return (
        `- "${project.name}" [project ref: project-${index + 1}]: ${summary.percentComplete}% complete, PPC ${summary.ppc ?? "n/a"}%, ` +
        `PRR ${summary.prr ?? "n/a"}%, ${summary.openRoadblocks} open roadblocks, ` +
        `health score ${summary.healthScore ?? "n/a"}, ${variance}, ` +
        `${formatDate(project.startDate)}-${formatDate(project.endDate)}`
      );
    })
    .join("\n");
  const totals = summaries.reduce(
    (accumulator, { summary }) => ({
      openRoadblocks: accumulator.openRoadblocks + summary.openRoadblocks,
      healthScores:
        summary.healthScore !== null
          ? [...accumulator.healthScores, summary.healthScore]
          : accumulator.healthScores,
    }),
    { openRoadblocks: 0, healthScores: [] as number[] }
  );
  const averageHealth = totals.healthScores.length
    ? Math.round(totals.healthScores.reduce((total, value) => total + value, 0) / totals.healthScores.length)
    : null;
  const focusBlock =
    focusProjectId && projects.some((project) => project.id === focusProjectId)
      ? `\n\nCURRENT PROJECT (detailed data):\n${await buildProjectContext(focusProjectId, userId)}`
      : "";

  return `TODAY: ${new Date().toISOString().slice(0, 10)}
ORGANIZATION: ${organization.name}
PORTFOLIO SUMMARY: ${projects.length} active project(s), ${totals.openRoadblocks} total open roadblocks, avg health score ${averageHealth ?? "n/a"}

PROJECTS:
${portfolioLines || "(none)"}${focusBlock}`;
}

export const ASSISTANT_SYSTEM_PROMPT =
  "You are Agent, an in-app construction planning assistant. " +
  "Use the supplied live organization and project data for schedules, roadblocks, commitments, portfolio health, submittals, and RFIs. " +
  "Never invent project facts. Name the project, task, date, or person that supports an answer when available. " +
  "If the data is insufficient, say exactly what is missing. You may prepare changes only through the available confirmation-gated proposal tools, and must not claim to have changed project data before confirmation. " +
  "Return only the user-facing answer; never output internal analysis, safety labels, or tool-call JSON. " +
  "Never mention database IDs, internal records, tool names, tool calls, lookup steps, or implementation details. " +
  "Use concise conversational text. You may use **bold** for short labels that improve scanning, but avoid decorative formatting and emojis unless the user requests them.\n\n";

export const ASSISTANT_TOOL_SYSTEM_PROMPT =
  ASSISTANT_SYSTEM_PROMPT +
  "For every question about current Agira data, call the most relevant read-only tool before answering, even when the context already contains a summary. " +
  "For questions about what an uploaded PDF, report, specification, drawing PDF, or project file contains, call searchProjectDocuments before answering. Use only its extracted snippets, cite the supporting file and page number, and state when searchable text is unavailable. " +
  "In portfolio conversations, pass the exact project ref shown in the portfolio context when a tool needs a project. " +
  "When the user asks to flag or update a roadblock, call proposeRoadblockChange directly with the task and owner names supplied by the user. Do not call task or member lookup tools first. Never ask the user for an ID. " +
  "When the user asks to create or update a schedule task, call proposeTaskChange directly. Put every requested name, schedule date, assignment, and note change into one proposal. Use YYYY-MM-DD dates and never claim the task changed before confirmation. " +
  "When the user asks to update actual start, actual finish, percent complete, field progress, or task completion status for existing work, call proposeTaskProgressChange directly. " +
  "When the user asks to commit a task to a weekly plan, mark a weekly commitment completed or not completed, or remove it from a future plan, call proposeWeeklyCommitmentChange directly. Use REMOVE only for a still-committed future week. Current, past, completed, and not-completed commitments cannot be removed; use NOT_COMPLETED with a variance reason for missed current work. " +
  "When the user asks to add or remove dependency logic, or shift one or more tasks by a number of days, call proposeScheduleChange directly. Preserve finish-to-start direction: the successor depends on the predecessor. Include all requested tasks in one bulk-shift proposal. " +
  "For a what-if question or a request to reflow, cascade, or propagate a task delay through downstream work, use REFLOW_SUCCESSORS with exactly one anchor task. Supply shiftDays when the user gives a relative change, or newStartDate/newEndDate in YYYY-MM-DD when the user gives a target date. This prepares a dependency-aware preview; it is never read-only analysis and still requires card confirmation before applying. " +
  "When the user asks to create, approve, or reject a Schedule Impact Request, call proposeScheduleImpactChange directly. " +
  "When the user asks to save, create, or capture a baseline, call proposeBaselineChange with operation CREATE and the requested baseline name. " +
  "When the user asks to compare the schedule to a baseline or show baseline variance, call proposeBaselineChange with operation COMPARE. Omit the name to use the latest baseline. " +
  "When the user asks to raise an RFI, answer an RFI, or close an RFI, call proposeRfiChange directly. A new RFI may include an optional linked task, due date, and source document (fileName with optional pageNumber or citationExcerpt). An answer must contain the exact answer to record. " +
  "When the user wants to submit or raise an RFI but has not given the question yet, ask only for the exact RFI question text. Never say a proposal was prepared. When they supply the question (including 'my question is ...'), call proposeRfiChange CREATE immediately. " +
  "When the user asks for task options while raising an RFI, list the project task names and tell them how to include one in the raise command. " +
  "When the user asks to raise an RFI from a project file or cited page, call proposeRfiChange with operation CREATE and include fileName plus any page/passage they named. Do not call searchProjectDocuments first for a clear document-to-RFI request. " +
  "When the user asks to create a submittal or change its review status, call proposeSubmittalChange directly. New submittals may include a spec section, linked task, due date, and source document (fileName with optional pageNumber or citationExcerpt). Use REVISE_RESUBMIT for revise-and-resubmit decisions. " +
  "When the user asks to create a submittal from a project file or cited page, call proposeSubmittalChange CREATE with fileName and any page/passage they named. When they ask to flag a task as a roadblock from a project file or cited page, call proposeRoadblockChange with taskName, note, fileName, and any page/passage. Do not search the document first when the requested title or roadblock note is already explicit. " +
  "RFI and submittal records synced from an external system are read-only in Agira; repeat the tool clarification instead of claiming a proposal exists. " +
  "If task search has no exact or clearly unambiguous match, ask one brief clarification that names at most three likely tasks. Do not dump the schedule, discuss your search process, or continue resolving other fields until the task is confirmed. " +
  "If a named owner or assignee has no unique match, ask one brief name clarification using human-readable names only. " +
  "A proposal is not an applied change: tell the user to review and confirm the proposal card, and never claim the project was changed before confirmation. " +
  "Never say that a proposal was prepared unless proposeRoadblockChange returned an action-proposal result. If it returned a clarification, repeat only its concise clarification message. " +
  "The same rule applies to proposeTaskChange: only an action-proposal result means a task proposal exists. " +
  "The same rule applies to proposeTaskProgressChange and proposeWeeklyCommitmentChange. " +
  "The same rule applies to proposeScheduleImpactChange and proposeBaselineChange. " +
  "The same rule applies to proposeScheduleChange. Cycles are blocked; schedule-impact warnings must be summarized briefly without claiming they prevent confirmation. " +
  "The same rule applies to proposeRfiChange and proposeSubmittalChange: only an action-proposal result means a project-controls proposal exists. " +
  "Tool results are rendered with clickable sources, so do not invent citation URLs in your prose.\n\n";

export async function answerAssistantQuestion(
  organizationId: string,
  question: string,
  options: { userId: string; focusProjectId?: string; history?: AssistantMessage[] }
): Promise<string> {
  const context = await buildAssistantContext(organizationId, options.userId, options?.focusProjectId);
  const { text } = await withProviderFallback((attempt) => generateText({
    model: attempt.model,
    ...attempt.requestOptions,
    system: ASSISTANT_SYSTEM_PROMPT + context,
    messages: [
      ...(options?.history ?? []).map((message) => ({ role: message.role, content: message.content })),
      { role: "user", content: question },
    ],
    temperature: 0.3,
    maxOutputTokens: 900,
  }));

  if (!text.trim()) throw new Error("The assistant returned an empty response - please try again.");
  return stripAssistantMarkdown(text.trim());
}

/** @deprecated Use answerAssistantQuestion. */
export async function answerScheduleQuestion(_projectId: string, _question: string): Promise<string> {
  void _projectId;
  void _question;
  throw new Error("answerScheduleQuestion requires a user-scoped call path. Use answerAssistantQuestion instead.");
}
