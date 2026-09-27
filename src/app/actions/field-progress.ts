"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  extractObservationsFromDpr,
  matchFieldEvidence,
  indexScheduleActivities,
  type ExtractedObservationItem,
} from "@/lib/retrieval-client";
import { logActivity } from "@/lib/activity-log";

export type SubmitDprInput = {
  projectId: string;
  rawText: string;
  inputType?: "FREE_TEXT" | "FILE_UPLOAD" | "VOICE_RECORDING";
  reportDate?: string;
  userId?: string;
};

export type ReviewDecisionInput = {
  candidateMatchId: string;
  decision: "APPROVED" | "REJECTED" | "REASSIGNED";
  notes?: string;
  reviewedBy?: string;
};

/**
 * Ingests a raw Daily Progress Report (DPR), extracts discrete observations via Gemini,
 * runs hybrid schedule-linking with contextual reranking, and persists to DB.
 */
export async function submitDprReport(input: SubmitDprInput) {
  const { projectId, rawText, inputType = "FREE_TEXT", reportDate, userId } = input;
  const effectiveDate = reportDate ? new Date(reportDate) : new Date();

  // 1. Persist the raw DPR container
  const dailyReport = await prisma.dailyReport.create({
    data: {
      projectId,
      rawContent: rawText,
      inputType,
      pipelineStatus: "PROCESSING",
    },
  });

  // 2. Extract atomic observations via Gemini LLM (1-to-N splitting)
  let extractedItems: ExtractedObservationItem[] = [];
  try {
    const extractionResult = await extractObservationsFromDpr(
      rawText,
      effectiveDate.toISOString().split("T")[0]
    );
    extractedItems = extractionResult.observations;
  } catch (extractErr) {
    console.warn("LLM extraction failed, creating single observation from text:", extractErr);
    extractedItems = [
      {
        raw_text: rawText.trim(),
        event_type: "PROGRESS",
        extracted_date: effectiveDate.toISOString().split("T")[0]!,
      },
    ];
  }

  // 3. Fetch current project tasks to index and match against
  const projectTasks = await prisma.task.findMany({
    where: { projectId },
    include: { assignedTo: { include: { user: true } } },
  });

  if (projectTasks.length > 0) {
    try {
      await indexScheduleActivities(
        projectTasks.map((t) => ({
          id: t.id,
          activity_id: t.wbsCode || t.id,
          name: t.name,
          level: t.level || 1,
          metadata: {
            discipline: t.discipline,
            assigned_to: t.assignedTo?.user?.name || undefined,
            status: t.status,
          },
          planned_start_date: t.startDate ? t.startDate.toISOString().split("T")[0] : undefined,
          planned_end_date: t.endDate ? t.endDate.toISOString().split("T")[0] : undefined,
          status: t.status,
        }))
      );
    } catch (indexErr) {
      console.warn("Auto-indexing tasks before DPR match failed:", indexErr);
    }
  }

  // 4. Process each observation and match against master schedule
  let autoLinkedCount = 0;
  const createdObservations = [];
  const updatedTasks: Array<{ id: string; name: string; progress: number; status: string }> = [];

  for (const item of extractedItems) {
    const obsDate = item.extracted_date ? new Date(item.extracted_date) : effectiveDate;

    // Fallback: extract progress percent via regex if LLM omitted it
    let extractedPercent = item.progress_percent ?? null;
    if (extractedPercent === null || extractedPercent === undefined) {
      const combinedText = `${item.raw_text} ${rawText}`;
      const percentMatch = combinedText.match(/(\d{1,3})\s*(?:%|percent)/i);
      if (percentMatch) {
        const parsed = parseInt(percentMatch[1], 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          extractedPercent = parsed;
        }
      }
    }

    // Create the observation record
    const obs = await prisma.extractedObservation.create({
      data: {
        dailyReportId: dailyReport.id,
        rawText: item.raw_text,
        eventType: item.event_type || "PROGRESS",
        extractedDate: obsDate,
        progressPercent: extractedPercent,
        sourceSpan: item.source_snippet ? { snippet: item.source_snippet } : undefined,
        matchStatus: "PENDING",
      },
    });

    // Run Stage 1 & Stage 2 matching against project schedule
    try {
      let matchResult = await matchFieldEvidence(
        {
          id: obs.id,
          raw_text: item.raw_text,
          extracted_date: obsDate.toISOString().split("T")[0],
          event_type: item.event_type,
        },
        undefined,
        5
      );

      const textLower = `${item.raw_text} ${rawText}`.toLowerCase();
      let matches = matchResult.matches ? [...matchResult.matches] : [];

      // Check if any project task name is explicitly mentioned in the text
      let exactTaskMatch: typeof projectTasks[0] | null = null;
      for (const t of projectTasks) {
        const nameLower = t.name.toLowerCase().trim();
        if (nameLower.length > 2 && textLower.includes(nameLower)) {
          exactTaskMatch = t;
          break;
        }
      }

      if (exactTaskMatch) {
        // Boost existing candidate or inject as top candidate with 0.95 confidence
        const existingIdx = matches.findIndex(
          (m) =>
            m.schedule_activity_id === exactTaskMatch.id ||
            m.name.toLowerCase() === exactTaskMatch.name.toLowerCase()
        );
        if (existingIdx !== -1) {
          matches[existingIdx] = {
            ...matches[existingIdx],
            confidence_score: Math.max(matches[existingIdx].confidence_score, 0.95),
            matching_reasons: [
              `Direct exact task name match for "${exactTaskMatch.name}"`,
              ...(matches[existingIdx].matching_reasons || []),
            ],
          };
          const [boosted] = matches.splice(existingIdx, 1);
          matches.unshift(boosted);
        } else {
          matches.unshift({
            schedule_activity_id: exactTaskMatch.id,
            activity_id: exactTaskMatch.wbsCode || exactTaskMatch.id,
            name: exactTaskMatch.name,
            confidence_score: 0.95,
            component_scores: { direct_task_mention: 0.95 },
            matching_reasons: [`Direct exact task name match for "${exactTaskMatch.name}"`],
            rank: 1,
          });
        }
      } else if (matches.length === 0) {
        // Direct keyword token fallback if microservice returned no matches
        const candidateScores: Array<{ task: typeof projectTasks[0]; score: number }> = [];

        for (const t of projectTasks) {
          const nameLower = t.name.toLowerCase();
          const words = nameLower.split(/\s+/).filter((w) => w.length > 2);
          const matchedCount = words.filter((w) => textLower.includes(w)).length;
          if (words.length > 0 && matchedCount > 0) {
            const ratio = matchedCount / words.length;
            if (ratio >= 0.4) {
              candidateScores.push({ task: t, score: 0.70 + ratio * 0.25 });
            }
          }
        }

        if (candidateScores.length > 0) {
          candidateScores.sort((a, b) => b.score - a.score);
          matches = candidateScores.slice(0, 5).map((cs, idx) => ({
            schedule_activity_id: cs.task.id,
            activity_id: cs.task.wbsCode || cs.task.id,
            name: cs.task.name,
            confidence_score: cs.score,
            component_scores: { direct_keyword_score: cs.score },
            matching_reasons: [`Direct keyword overlap with "${cs.task.name}"`],
            rank: idx + 1,
          }));
        }
      }

      // Re-index ranks
      matches = matches.map((m, idx) => ({ ...m, rank: idx + 1 }));
      matchResult.matches = matches;

      // Persist CandidateMatches with component score breakdowns
      if (matchResult.matches && matchResult.matches.length > 0) {
        for (const candidate of matchResult.matches) {
          const task = projectTasks.find(
            (t) =>
              t.id === candidate.schedule_activity_id ||
              t.name.toLowerCase() === candidate.name.toLowerCase()
          );

          if (task) {
            await prisma.candidateMatch.create({
              data: {
                observationId: obs.id,
                taskId: task.id,
                confidenceScore: candidate.confidence_score,
                componentScores: {
                  ...candidate.component_scores,
                  matching_reasons: candidate.matching_reasons,
                },
              },
            });
          }
        }

        // Apply Routing Thresholds:
        // >= 0.70 or single match >= 0.60 auto-links and directly updates the task on the schedule
        const topMatch = matchResult.matches[0];
        const isAutoLink =
          topMatch &&
          (topMatch.confidence_score >= 0.70 ||
            (matchResult.matches.length === 1 && topMatch.confidence_score >= 0.60));

        if (isAutoLink && topMatch) {
          const matchedTask = projectTasks.find(
            (t) =>
              t.id === topMatch.schedule_activity_id ||
              t.name.toLowerCase() === topMatch.name.toLowerCase()
          );

          if (matchedTask) {
            // 1. Mark observation as AUTO_LINKED
            await prisma.extractedObservation.update({
              where: { id: obs.id },
              data: {
                matchStatus: "AUTO_LINKED",
                taskId: matchedTask.id,
              },
            });

            // 2. Compute updated progress & status
            const newProgress =
              extractedPercent !== null && extractedPercent !== undefined
                ? Math.round(extractedPercent)
                : item.event_type === "COMPLETED"
                ? 100
                : matchedTask.progress;

            const newStatus =
              newProgress >= 100
                ? "DONE"
                : newProgress > 0
                ? "IN_PROGRESS"
                : matchedTask.status;

            // 3. Update task in database
            await prisma.task.update({
              where: { id: matchedTask.id },
              data: {
                progress: newProgress,
                status: newStatus,
                actualStartDate: matchedTask.actualStartDate || obsDate,
                actualFinishDate: newProgress >= 100 ? obsDate : matchedTask.actualFinishDate,
              },
            });

            updatedTasks.push({
              id: matchedTask.id,
              name: matchedTask.name,
              progress: newProgress,
              status: newStatus,
            });

            // 4. Record ApprovedScheduleEvent with automated ReviewDecision
            try {
              const candidateMatch = await prisma.candidateMatch.findFirst({
                where: { observationId: obs.id, taskId: matchedTask.id },
              });
              if (candidateMatch) {
                const autoDecision = await prisma.reviewDecision.create({
                  data: {
                    candidateMatchId: candidateMatch.id,
                    decision: "APPROVED",
                    reviewedBy: "System (Auto-Linked DPR)",
                    notes: `Auto-linked with ${Math.round(topMatch.confidence_score * 100)}% confidence`,
                  },
                });
                await prisma.approvedScheduleEvent.create({
                  data: {
                    eventType: item.event_type || "PROGRESS",
                    actualDate: obsDate,
                    progressPercent: newProgress,
                    taskId: matchedTask.id,
                    sourceObservationId: obs.id,
                    reviewDecisionId: autoDecision.id,
                  },
                });
              }
            } catch (eventErr) {
              console.warn("Could not record ApprovedScheduleEvent for auto-link:", eventErr);
            }

            // 5. Activity log
            if (userId || dailyReport.id) {
              await logActivity({
                projectId,
                taskId: matchedTask.id,
                userId: userId || "SYSTEM",
                action: "AUTO_LINK_PROGRESS",
                detail: `Field intake auto-linked observation. Progress updated to ${newProgress}% (${newStatus}).`,
                source: "SYSTEM",
              });
            }

            autoLinkedCount++;
          }
        } else if (topMatch && topMatch.confidence_score >= 0.60) {
          await prisma.extractedObservation.update({
            where: { id: obs.id },
            data: { matchStatus: "PENDING_REVIEW" },
          });
        } else {
          await prisma.extractedObservation.update({
            where: { id: obs.id },
            data: { matchStatus: "UNMATCHED" },
          });
        }
      }
    } catch (matchErr) {
      console.warn(`Matching failed for observation ${obs.id}:`, matchErr);
      await prisma.extractedObservation.update({
        where: { id: obs.id },
        data: { matchStatus: "UNMATCHED" },
      });
    }

    createdObservations.push(obs);
  }

  // Update DailyReport status
  await prisma.dailyReport.update({
    where: { id: dailyReport.id },
    data: {
      pipelineStatus: autoLinkedCount === createdObservations.length ? "AUTO_LINKED" : "NEEDS_REVIEW",
    },
  });

  try {
    revalidatePath(`/projects/${projectId}/review-queue`);
    revalidatePath(`/projects/${projectId}/gantt`);
    revalidatePath(`/projects/${projectId}/tasks`);
    revalidatePath(`/projects/${projectId}/dashboard`);
    revalidatePath(`/projects/${projectId}/field-intake`);
    revalidatePath(`/projects/${projectId}/plan-vs-actual`);
    revalidatePath(`/projects/${projectId}`);
  } catch (revErr) {
    // Outside Next.js request context during tests/scripts, safe to ignore
    console.warn("revalidatePath skipped:", revErr instanceof Error ? revErr.message : revErr);
  }

  return {
    success: true,
    dailyReportId: dailyReport.id,
    observationsCount: createdObservations.length,
    autoLinkedCount,
    updatedTasks,
  };
}

/**
 * Human Reviewer submits Approve, Reject, or Reassign on a candidate match.
 */
export async function submitReviewDecision(input: ReviewDecisionInput) {
  const { candidateMatchId, decision, notes, reviewedBy } = input;

  const match = await prisma.candidateMatch.findUnique({
    where: { id: candidateMatchId },
    include: {
      observation: true,
      task: true,
    },
  });

  if (!match) {
    throw new Error("Candidate match not found");
  }

  // Record human decision
  const reviewDecision = await prisma.reviewDecision.create({
    data: {
      candidateMatchId,
      decision,
      notes,
      reviewedBy: reviewedBy || "QA Reviewer",
    },
  });

  if (decision === "APPROVED") {
    // 1. Generate immutable ApprovedScheduleEvent
    await prisma.approvedScheduleEvent.create({
      data: {
        eventType: match.observation.eventType,
        actualDate: match.observation.extractedDate,
        progressPercent: match.observation.progressPercent,
        taskId: match.taskId,
        sourceObservationId: match.observationId,
        reviewDecisionId: reviewDecision.id,
      },
    });

    // 2. Lock observation to this task
    await prisma.extractedObservation.update({
      where: { id: match.observationId },
      data: {
        matchStatus: "AUTO_LINKED",
        taskId: match.taskId,
      },
    });

    // 3. Update task progress & dates dynamically on the schedule
    const newProgress = match.observation.progressPercent !== null && match.observation.progressPercent !== undefined
      ? Math.round(match.observation.progressPercent)
      : match.observation.eventType === "COMPLETED"
      ? 100
      : match.task.progress;

    await prisma.task.update({
      where: { id: match.taskId },
      data: {
        progress: newProgress,
        status: newProgress >= 100 ? "DONE" : newProgress > 0 ? "IN_PROGRESS" : match.task.status,
        actualStartDate: match.task.actualStartDate || match.observation.extractedDate,
        actualFinishDate: newProgress >= 100 ? match.observation.extractedDate : match.task.actualFinishDate,
      },
    });

    // 4. Log in append-only activity log
    if (reviewedBy) {
      await logActivity({
        projectId: match.task.projectId,
        taskId: match.taskId,
        taskName: match.task.name,
        userId: reviewedBy,
        action: "observation_approved",
        detail: `Approved DPR link to task '${match.task.name}' (${newProgress}% progress)`,
        entityType: "SCHEDULE_EVENT",
        entityId: match.id,
        source: "UI",
      });
    }
  } else if (decision === "REJECTED") {
    await prisma.extractedObservation.update({
      where: { id: match.observationId },
      data: { matchStatus: "UNMATCHED" },
    });
  }

  revalidatePath(`/projects/${match.task.projectId}/review-queue`);
  revalidatePath(`/projects/${match.task.projectId}/gantt`);
  revalidatePath(`/projects/${match.task.projectId}/plan-vs-actual`);

  return { success: true, decisionId: reviewDecision.id };
}

/**
 * Retrieves the prioritized review queue for a project.
 */
export async function getProjectReviewQueue(projectId: string) {
  const observations = await prisma.extractedObservation.findMany({
    where: {
      dailyReport: { projectId },
    },
    include: {
      task: true,
      dailyReport: true,
      candidateMatches: {
        include: {
          task: true,
          reviewDecisions: true,
        },
        orderBy: { confidenceScore: "desc" },
      },
    },
    orderBy: { extractedDate: "desc" },
  });

  const autoLinked = observations.filter((o) => o.matchStatus === "AUTO_LINKED");
  const pendingReview = observations.filter((o) => o.matchStatus === "PENDING_REVIEW" || o.matchStatus === "PENDING");
  const unmatched = observations.filter((o) => o.matchStatus === "UNMATCHED");

  return {
    autoLinked,
    pendingReview,
    unmatched,
    totalCount: observations.length,
  };
}
