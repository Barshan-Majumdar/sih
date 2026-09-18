import type { CommitmentStatus } from "@prisma/client";
import { getWeekStart } from "@/lib/utils";

type RemovalCandidate = {
  status: CommitmentStatus;
  weekStartDate: Date;
  removedAt: Date | null;
};

export function isFutureCommitmentWeek(weekStartDate: Date, now = new Date()) {
  return getWeekStart(weekStartDate).getTime() > getWeekStart(now).getTime();
}

export function commitmentRemovalError(candidate: RemovalCandidate, now = new Date()): string | null {
  if (candidate.removedAt) return "This commitment has already been removed from the weekly plan.";
  if (candidate.status !== "COMMITTED") {
    return "Only commitments that are still committed can be removed from the weekly plan.";
  }
  if (!isFutureCommitmentWeek(candidate.weekStartDate, now)) {
    return "Only future-week commitments can be removed. Record current or past missed work as not completed with a variance reason.";
  }
  return null;
}
