const ROADBLOCK_ACTION = /\b(add|assign|change|clear|create|edit|flag|mark|remove|set|update)\b/i;
const ROADBLOCK_SUBJECT = /\b(blocked|blocker|roadblock)\b/i;
const TASK_ACTION = /\b(add|assign|change|create|edit|move|rename|reschedule|set|unassign|update)\b/i;
const TASK_SUBJECT = /\b(activity|assignee|assignment|date|end|progress|schedule|start|status|task)\b/i;
const DIRECT_TASK_ACTION = /\b(assign|create|move|rename|reschedule|unassign)\b/i;
const TASK_PROGRESS_ACTION = /\b(mark|record|report|set|update)\b/i;
const TASK_PROGRESS_SUBJECT = /\b(actual|complete|completed|finish|finished|progress|started|start|status|%)\b/i;
const WEEKLY_COMMITMENT_ACTION = /\b(change|commit|committed|complete|completed|delete|finish|mark|promise|remove|set|uncommit|update)\b/i;
const WEEKLY_COMMITMENT_SUBJECT = /\b(commitment|variance|weekly|week|wwp|plan)\b/i;
const READ_ONLY_OPENING = /^(how|is|list|show|tell|what|which|why)\b/i;
const DEPENDENCY_ACTION = /\b(add|change|create|link|make|remove|set|unlink)\b/i;
const DEPENDENCY_SUBJECT = /\b(dependency|depend|depends|logic|predecessor|successor)\b/i;
const SHIFT_ACTION = /\b(move|pull|push|shift)\b/i;
const BULK_SHIFT_SUBJECT = /\b(all|activities|days?|entire|incomplete|schedule|tasks?|weeks?)\b/i;
const WHAT_IF_SCHEDULE = /\bwhat (?:happens|would happen) if\b|\b(reflow|cascade|propagate)\b/i;
const RFI_ACTION = /\b(answer|close|create|file|need|open|raise|record|respond|submit|update|want)\b/i;
const RFI_SUBJECT = /\bRFI(?:s)?\b|\brequest(?:s)? for information\b/i;
const RFI_CREATE_SOFT =
  /^(?:i\s+(?:just\s+)?(?:want|need|would like)\s+to\s+)?(?:create|file|open|raise|record|submit)\s+(?:an?\s+)?(?:new\s+)?rfi\b/i;
const RFI_QUESTION_SUPPLY =
  /^(?:my\s+)?(?:rfi\s+)?question(?:\s+for\s+(?:the\s+)?(?:new\s+)?rfi)?\s*(?:is|:)\s*["'\u201c]?(.+?)["'\u201d]?\s*$/i;
const RFI_TASK_LIST_REQUEST =
  /\b((?:all\s+)?(?:the\s+)?task(?:s)?(?:\s+options)?|list(?:\s+the)?\s+tasks|which tasks?|task list|link(?:ed)? task)\b/i;
const SUBMITTAL_ACTION = /\b(approve|create|reject|revise|submit|update)\b/i;
const SUBMITTAL_SUBJECT = /\bsubmittal(?:s)?\b/i;
const SCHEDULE_IMPACT_ACTION = /\b(approve|create|reject|review|submit)\b/i;
const SCHEDULE_IMPACT_SUBJECT = /\b(schedule impact|impact request|SIR)\b/i;
const BASELINE_ACTION = /\b(capture|compare|create|save)\b/i;
const BASELINE_SUBJECT = /\bbaseline\b/i;
const AFFIRMATIVE_REPLY = /^(confirm|do it|go ahead|okay|ok|proceed|sure|yes)([,.! ]+(do it|please|proceed))?[.! ]*$/i;

export type DeterministicScheduleWhatIf = {
  operation: "REFLOW_SUCCESSORS";
  anchorTaskName: string;
  shiftDays?: number;
  newStartDate?: string;
  newEndDate?: string;
};

export type DeterministicProjectControlAction =
  | {
      toolName: "proposeRfiChange";
      input: {
        operation: "CREATE" | "ANSWER" | "CLOSE";
        question: string;
        answer?: string;
        fileName?: string;
        pageNumber?: number;
        citationExcerpt?: string;
      };
    }
  | {
      toolName: "proposeSubmittalChange";
      input: {
        operation: "CREATE" | "UPDATE_STATUS";
        title: string;
        status?: "APPROVED" | "REJECTED" | "REVISE_RESUBMIT";
        fileName?: string;
        pageNumber?: number;
        citationExcerpt?: string;
      };
    };

export type DeterministicRoadblockAction = {
  toolName: "proposeRoadblockChange";
  input: {
    taskName: string;
    note: string;
    fileName: string;
    pageNumber?: number;
    citationExcerpt?: string;
  };
};

export type DeterministicTaskProgressAction = {
  toolName: "proposeTaskProgressChange";
  input: {
    taskName: string;
    actualStartDate?: string | null;
    actualFinishDate?: string | null;
    status?: "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "DELAYED";
    progress?: number;
    note?: string;
  };
};

export type DeterministicWeeklyCommitmentAction = {
  toolName: "proposeWeeklyCommitmentChange";
  input: {
    operation: "CREATE" | "UPDATE_STATUS" | "REMOVE";
    taskName: string;
    weekStartDate: string;
    status?: "COMMITTED" | "COMPLETED" | "NOT_COMPLETED";
    reasonForVariance?: string;
    removalReason?: string;
  };
};

export type DeterministicScheduleImpactAction = {
  toolName: "proposeScheduleImpactChange";
  input: {
    operation: "CREATE" | "REVIEW";
    taskName?: string;
    description?: string;
    proposedNewEndDate?: string | null;
    status?: "APPROVED" | "REJECTED";
    reviewNote?: string | null;
  };
};

export type DeterministicBaselineAction = {
  toolName: "proposeBaselineChange";
  input: {
    operation: "CREATE" | "COMPARE";
    name?: string;
  };
};

const MONTHS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function isoDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function parseWhatIfDate(value: string, now: Date): string | null {
  const cleaned = value.trim().replace(/[?.!"\u201c\u201d]+$/g, "").trim();
  const direct = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleaned);
  if (direct) return isoDate(Number(direct[1]), Number(direct[2]), Number(direct[3]));

  const named = /^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i.exec(cleaned);
  if (named) {
    const month = MONTHS[named[1].toLowerCase()];
    if (!month) return null;
    return isoDate(Number(named[3] ?? now.getUTCFullYear()), month, Number(named[2]));
  }

  const weekday = /^(?:next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.exec(
    cleaned
  );
  if (weekday) {
    const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const target = weekdays.indexOf(weekday[1].toLowerCase());
    const days = ((target - now.getUTCDay() + 7) % 7) || 7;
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
    return date.toISOString().slice(0, 10);
  }
  return null;
}

function cleanAnchorName(value: string) {
  return value
    .trim()
    .replace(/^the\s+(?:task|activity)\s+/i, "")
    .replace(/^["\u201c]+|["\u201d]+$/g, "")
    .trim();
}

function parseHumanDate(value: string, now: Date): string | null {
  return parseWhatIfDate(value, now);
}

function mondayOfWeek(date: Date): string {
  const day = date.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff));
  return monday.toISOString().slice(0, 10);
}

function parseWeekStart(value: string | undefined, now: Date): string {
  if (!value) return mondayOfWeek(now);
  const cleaned = value.trim().toLowerCase();
  if (cleaned === "this week") return mondayOfWeek(now);
  if (cleaned === "next week") {
    const thisMonday = new Date(`${mondayOfWeek(now)}T12:00:00.000Z`);
    return new Date(Date.UTC(thisMonday.getUTCFullYear(), thisMonday.getUTCMonth(), thisMonday.getUTCDate() + 7))
      .toISOString()
      .slice(0, 10);
  }
  return parseHumanDate(cleaned.replace(/^week of\s+/i, ""), now) ?? mondayOfWeek(now);
}

export function parseDeterministicTaskProgressAction(
  message: string,
  now = new Date()
): DeterministicTaskProgressAction | null {
  const cleaned = message.trim().replace(/^["\u201c]|["\u201d]$/g, "").trim();
  const input: DeterministicTaskProgressAction["input"] = { taskName: "" };

  const percent = /\b(?:to|at|is|progress)\s+(\d{1,3})\s*%|\b(\d{1,3})\s*%\s+(?:complete|completed)/i.exec(cleaned);
  if (percent) {
    const value = Number(percent[1] ?? percent[2]);
    if (value >= 0 && value <= 100) input.progress = value;
  }
  const actualStart = /\bactual(?:ly)?\s+(?:started|start)\s+(?:on\s+)?(.+?)(?:\s+and\b|$)/i.exec(cleaned);
  if (actualStart) input.actualStartDate = parseHumanDate(actualStart[1], now) ?? undefined;
  const actualFinish = /\bactual(?:ly)?\s+(?:finished|finish|completed|complete)\s+(?:on\s+)?(.+?)(?:\s+and\b|$)/i.exec(cleaned);
  if (actualFinish) input.actualFinishDate = parseHumanDate(actualFinish[1], now) ?? undefined;
  if (input.progress !== undefined) {
    input.status = input.progress === 100 ? "DONE" : "IN_PROGRESS";
  } else if (/\bmark\b.+\b(done|complete|completed)\b/i.test(cleaned) || /\b(done|complete|completed)\b/i.test(cleaned)) {
    input.status = "DONE";
    input.progress ??= 100;
  } else if (/\b(?:as|to|status(?:\s+to)?)\s+(?:in progress|started)\b/i.test(cleaned)) {
    input.status = "IN_PROGRESS";
  } else if (/\b(delayed|late)\b/i.test(cleaned)) {
    input.status = "DELAYED";
  } else if (/\b(?:as|to|status(?:\s+to)?)\s+not started\b/i.test(cleaned)) {
    input.status = "NOT_STARTED";
    input.progress = 0;
  } else if (input.actualStartDate) {
    input.status = "IN_PROGRESS";
  }

  const taskMatch =
    /^(?:mark|record|report|set|update)\s+(.+?)\s+(?:actual|as|to|at|is|progress|\d{1,3}\s*%)/i.exec(cleaned) ||
    /^(.+?)\s+(?:is\s+)?(?:\d{1,3}\s*%|complete|completed|done|delayed|late)/i.exec(cleaned);
  const taskName = taskMatch
    ? cleanAnchorName(taskMatch[1]).replace(/\s+(?:task\s+)?status$/i, "").trim()
    : "";
  if (!taskName || Object.keys(input).length <= 1) return null;
  input.taskName = taskName;
  return { toolName: "proposeTaskProgressChange", input };
}

export function parseDeterministicWeeklyCommitmentAction(
  message: string,
  now = new Date()
): DeterministicWeeklyCommitmentAction | null {
  const cleaned = message.trim().replace(/^["\u201c]|["\u201d]$/g, "").trim();
  const removeFromPossessivePlan = /^(?:delete|remove|uncommit)\s+(.+?)(?:\s+commitment)?\s+from\s+((?:this|next)\s+week)(?:'s|\u2019s)\s+(?:weekly\s+)?plan(?:\s+(?:because|reason:?)\s+(.+))?$/i.exec(cleaned);
  const removeFromPlan = /^(?:delete|remove|uncommit)\s+(.+?)(?:\s+commitment)?\s+from\s+(?:(?:the\s+)?weekly\s+plan\s+for\s+)?((?:this|next)\s+week|week of\s+.+?|\d{4}-\d{2}-\d{2})(?:\s+(?:because|reason:?)\s+(.+))?$/i.exec(cleaned);
  const remove = removeFromPossessivePlan ?? removeFromPlan;
  if (remove) {
    return {
      toolName: "proposeWeeklyCommitmentChange",
      input: {
        operation: "REMOVE",
        taskName: cleanAnchorName(remove[1]),
        weekStartDate: parseWeekStart(remove[2], now),
        removalReason: remove[3]?.trim(),
      },
    };
  }

  const commit = /^(?:commit|promise)\s+(.+?)\s+(?:for|to)\s+((?:this|next)\s+week|week of\s+.+|\d{4}-\d{2}-\d{2})/i.exec(cleaned);
  if (commit) {
    return {
      toolName: "proposeWeeklyCommitmentChange",
      input: {
        operation: "CREATE",
        taskName: cleanAnchorName(commit[1]),
        weekStartDate: parseWeekStart(commit[2], now),
      },
    };
  }

  const directComplete = /^(?:complete|finish)\s+(.+?)(?:\s+commitment)?(?:\s+for\s+((?:this|next)\s+week|week of\s+.+|\d{4}-\d{2}-\d{2}))?$/i.exec(cleaned);
  if (directComplete) {
    return {
      toolName: "proposeWeeklyCommitmentChange",
      input: {
        operation: "UPDATE_STATUS",
        taskName: cleanAnchorName(directComplete[1]),
        weekStartDate: parseWeekStart(directComplete[2], now),
        status: "COMPLETED",
      },
    };
  }

  const varianceReason = /^(?:change|set|update)\s+(?:the\s+)?variance reason for\s+(.+?)(?:\s+commitment)?(?:\s+for\s+((?:this|next)\s+week|week of\s+.+?|\d{4}-\d{2}-\d{2}))?\s+(?:because|to)\s+(.+)$/i.exec(cleaned);
  if (varianceReason) {
    return {
      toolName: "proposeWeeklyCommitmentChange",
      input: {
        operation: "UPDATE_STATUS",
        taskName: cleanAnchorName(varianceReason[1]),
        weekStartDate: parseWeekStart(varianceReason[2], now),
        status: "NOT_COMPLETED",
        reasonForVariance: varianceReason[3].trim(),
      },
    };
  }

  const status = /^(?:mark|update)\s+(.+?)\s+(?:commitment\s+)?(?:as\s+)?(completed|complete|not completed)(?:\s+for\s+((?:this|next)\s+week|week of\s+.+|\d{4}-\d{2}-\d{2}))?(?:\s+(?:because|reason:?)\s+(.+))?$/i.exec(cleaned);
  if (status) {
    const isNotCompleted = /^not completed$/i.test(status[2]);
    return {
      toolName: "proposeWeeklyCommitmentChange",
      input: {
        operation: "UPDATE_STATUS",
        taskName: cleanAnchorName(status[1]),
        weekStartDate: parseWeekStart(status[3], now),
        status: isNotCompleted ? "NOT_COMPLETED" : "COMPLETED",
        reasonForVariance: status[4]?.trim(),
      },
    };
  }
  return null;
}

export function parseDeterministicScheduleImpactAction(
  message: string,
  now = new Date()
): DeterministicScheduleImpactAction | null {
  const cleaned = message.trim().replace(/^["\u201c]|["\u201d]$/g, "").trim();
  const create = /^(?:create|submit|record)\s+(?:a\s+)?(?:schedule impact request|impact request|sir)(?:\s+for\s+(.+?))?\s*[:\-]\s*(.+)$/i.exec(cleaned);
  if (create) {
    const description = cleanControlText(create[2]);
    const finish = /\b(?:push|move|extend|finish|end)\S*\s+(?:finish|end)?\s*(?:to|until|on)\s+(.+?)(?:[.!?]|$)/i.exec(description);
    const directDate = /\b(\d{4}-\d{2}-\d{2})\b/.exec(description);
    const proposedNewEndDate = directDate?.[1] ?? (finish ? parseHumanDate(finish[1], now) ?? undefined : undefined);
    return {
      toolName: "proposeScheduleImpactChange",
      input: {
        operation: "CREATE",
        taskName: create[1] ? cleanAnchorName(create[1]) : undefined,
        description,
        proposedNewEndDate,
      },
    };
  }

  const review = /^(approve|reject)\s+(?:the\s+)?(?:schedule impact request|impact request|sir)\s+(.+?)(?:\s+(?:because|with note:|note:)\s+(.+))?$/i.exec(cleaned);
  if (review) {
    return {
      toolName: "proposeScheduleImpactChange",
      input: {
        operation: "REVIEW",
        description: cleanControlText(review[2]),
        status: review[1].toLowerCase() === "approve" ? "APPROVED" : "REJECTED",
        reviewNote: review[3]?.trim(),
      },
    };
  }
  return null;
}

export function parseDeterministicBaselineAction(message: string): DeterministicBaselineAction | null {
  const cleaned = message.trim().replace(/^["\u201c]|["\u201d]$/g, "").trim();
  const compare =
    /^(?:compare|show(?:\s+variance)?)\s+(?:(?:the\s+)?(?:current\s+)?(?:schedule|project)\s+)?(?:to|against|with|vs\.?)\s+(?:the\s+)?(?:latest\s+)?baseline(?:\s+(?:named|called)\s+(.+))?$/i.exec(
      cleaned
    ) ??
    /^(?:compare|show(?:\s+variance)?)\s+(?:to|against|with|vs\.?)\s+(?:the\s+)?baseline(?:\s+(?:named|called))?\s+(.+)$/i.exec(
      cleaned
    );
  if (compare) {
    const name = compare[1] ? cleanControlText(compare[1]) : undefined;
    return {
      toolName: "proposeBaselineChange",
      input: { operation: "COMPARE", ...(name ? { name } : {}) },
    };
  }

  const named = /^(?:create|save|capture)\s+(?:a\s+)?baseline(?:\s+(?:named|called))?\s+(.+)$/i.exec(cleaned);
  if (!named) return null;
  const name = cleanControlText(named[1]);
  return name ? { toolName: "proposeBaselineChange", input: { operation: "CREATE", name } } : null;
}

export function parseDeterministicScheduleWhatIf(
  message: string,
  now = new Date()
): DeterministicScheduleWhatIf | null {
  const cleaned = message
    .trim()
    .replace(/^["\u201c]|["\u201d]$/g, "")
    .replace(/\s+(?:and\s+)?(?:reflow|cascade|propagate)\b.*$/i, "")
    .trim();
  const finish = /^(?:what happens if\s+)?(.+?)\s+(?:finishes|finish|ends|end)\s+(?:on\s+)?(.+?)\??$/i.exec(
    cleaned
  );
  if (finish) {
    const newEndDate = parseWhatIfDate(finish[2], now);
    const anchorTaskName = cleanAnchorName(finish[1]);
    if (newEndDate && anchorTaskName) {
      return { operation: "REFLOW_SUCCESSORS", anchorTaskName, newEndDate };
    }
  }

  const start = /^(?:what happens if\s+)?(.+?)\s+(?:starts|start|begins|begin)\s+(?:on\s+)?(.+?)\??$/i.exec(
    cleaned
  );
  if (start) {
    const newStartDate = parseWhatIfDate(start[2], now);
    const anchorTaskName = cleanAnchorName(start[1]);
    if (newStartDate && anchorTaskName) {
      return { operation: "REFLOW_SUCCESSORS", anchorTaskName, newStartDate };
    }
  }

  const delayed = /^(?:what happens if\s+)?(.+?)\s+(?:is\s+)?(?:delayed|pushed)\s+by\s+(\d+)\s+days?/i.exec(
    cleaned
  );
  if (delayed) {
    return {
      operation: "REFLOW_SUCCESSORS",
      anchorTaskName: cleanAnchorName(delayed[1]),
      shiftDays: Number(delayed[2]),
    };
  }

  const delay = /^delay\s+(.+?)\s+by\s+(\d+)\s+days?/i.exec(cleaned);
  if (delay) {
    return {
      operation: "REFLOW_SUCCESSORS",
      anchorTaskName: cleanAnchorName(delay[1]),
      shiftDays: Number(delay[2]),
    };
  }

  const move = /^move\s+(.+?)\s+(\d+)\s+days?\s+(earlier|later)/i.exec(cleaned);
  if (move) {
    const days = Number(move[2]);
    return {
      operation: "REFLOW_SUCCESSORS",
      anchorTaskName: cleanAnchorName(move[1]),
      shiftDays: move[3].toLowerCase() === "earlier" ? -days : days,
    };
  }
  return null;
}

function cleanControlText(value: string) {
  return value
    .trim()
    .replace(/^[:\s"\u201c]+|[?.!\s"\u201d]+$/g, "")
    .trim();
}

export function parseDeterministicProjectControlAction(
  message: string
): DeterministicProjectControlAction | null {
  const cleaned = message.trim().replace(/^['"\u201c]|['"\u201d]$/g, "").trim();
  const answer = /^(?:answer|respond to)\s+(?:the\s+)?rfi\s+(.+?)\s+(?:with|answer(?:ed)?\s*:)\s+(.+)$/i.exec(cleaned);
  if (answer) {
    const question = cleanControlText(answer[1]);
    const response = cleanControlText(answer[2]);
    if (question && response) {
      return { toolName: "proposeRfiChange", input: { operation: "ANSWER", question, answer: response } };
    }
  }

  const close = /^close\s+(?:the\s+)?rfi\s+(.+)$/i.exec(cleaned);
  if (close) {
    const question = cleanControlText(close[1]);
    if (question) return { toolName: "proposeRfiChange", input: { operation: "CLOSE", question } };
  }

  const createFromDocPage =
    /^(?:create|file|open|raise|record|submit)\s+(?:an?\s+)?rfi\s+from\s+(?:the\s+)?(?:file\s+)?(.+?)\s+page\s+(\d+)\s*[:\-]\s*(.+)$/i.exec(
      cleaned
    );
  if (createFromDocPage) {
    const fileName = cleanAnchorName(createFromDocPage[1]);
    const pageNumber = Number(createFromDocPage[2]);
    const question = cleanControlText(createFromDocPage[3]);
    if (fileName && question && Number.isFinite(pageNumber)) {
      return {
        toolName: "proposeRfiChange",
        input: { operation: "CREATE", question, fileName, pageNumber },
      };
    }
  }

  const createFromDoc =
    /^(?:create|file|open|raise|record|submit)\s+(?:an?\s+)?rfi\s+from\s+(?:the\s+)?(?:file\s+)?(.+?)\s*[:\-]\s*(.+)$/i.exec(
      cleaned
    ) ??
    /^(?:create|file|open|raise|record|submit)\s+(?:an?\s+)?rfi\s+from\s+(?:the\s+)?(?:file\s+)?(.+?)\s+(?:asking|about)\s+(.+)$/i.exec(
      cleaned
    );
  if (createFromDoc) {
    const fileName = cleanAnchorName(createFromDoc[1]);
    const question = cleanControlText(createFromDoc[2]);
    if (fileName && question) {
      return {
        toolName: "proposeRfiChange",
        input: { operation: "CREATE", question, fileName },
      };
    }
  }

  const suppliedQuestion = RFI_QUESTION_SUPPLY.exec(cleaned);
  if (suppliedQuestion) {
    const question = cleanControlText(suppliedQuestion[1]);
    if (question) return { toolName: "proposeRfiChange", input: { operation: "CREATE", question } };
  }

  const createRfi =
    /^(?:i\s+(?:just\s+)?(?:want|need|would like)\s+to\s+)?(?:create|file|open|raise|record|submit)\s+(?:an?\s+)?(?:new\s+)?rfi(?:\s+(?:asking|for|about|regarding|on))?\s*[:\-]?\s*(.+)$/i.exec(
      cleaned
    );
  if (createRfi) {
    const question = cleanControlText(createRfi[1]);
    if (
      question &&
      !/^(?:please|now|today|for me|here)?\.?$/i.test(question) &&
      !/^(?:from|with|to)\b/i.test(question)
    ) {
      return { toolName: "proposeRfiChange", input: { operation: "CREATE", question } };
    }
  }

  const decision = /^(approve|reject|revise)\s+(?:the\s+)?submittal\s+(.+)$/i.exec(cleaned);
  if (decision) {
    const title = cleanControlText(decision[2]);
    const status = decision[1].toLowerCase() === "approve"
      ? "APPROVED"
      : decision[1].toLowerCase() === "reject"
        ? "REJECTED"
        : "REVISE_RESUBMIT";
    if (title) {
      return { toolName: "proposeSubmittalChange", input: { operation: "UPDATE_STATUS", title, status } };
    }
  }

  const createSubmittalFromDocPage =
    /^(?:create|submit)\s+(?:an?\s+)?submittal\s+from\s+(?:the\s+)?(?:file\s+)?(.+?)\s+page\s+(\d+)\s*[:\-]\s*(.+)$/i.exec(
      cleaned
    );
  if (createSubmittalFromDocPage) {
    const fileName = cleanAnchorName(createSubmittalFromDocPage[1]);
    const pageNumber = Number(createSubmittalFromDocPage[2]);
    const title = cleanControlText(createSubmittalFromDocPage[3]);
    if (fileName && title && Number.isFinite(pageNumber)) {
      return {
        toolName: "proposeSubmittalChange",
        input: { operation: "CREATE", title, fileName, pageNumber },
      };
    }
  }

  const createSubmittalFromDoc =
    /^(?:create|submit)\s+(?:an?\s+)?submittal\s+from\s+(?:the\s+)?(?:file\s+)?(.+?)\s*[:\-]\s*(.+)$/i.exec(
      cleaned
    );
  if (createSubmittalFromDoc) {
    const fileName = cleanAnchorName(createSubmittalFromDoc[1]);
    const title = cleanControlText(createSubmittalFromDoc[2]);
    if (fileName && title) {
      return {
        toolName: "proposeSubmittalChange",
        input: { operation: "CREATE", title, fileName },
      };
    }
  }

  const createSubmittal = /^(?:create|submit)\s+(?:an?\s+)?submittal(?:\s+(?:called|named|for))?\s*[:\-]?\s*(.+)$/i.exec(cleaned);
  if (createSubmittal) {
    const title = cleanControlText(createSubmittal[1]);
    if (title) return { toolName: "proposeSubmittalChange", input: { operation: "CREATE", title } };
  }
  return null;
}

export function parseDeterministicRoadblockAction(
  message: string
): DeterministicRoadblockAction | null {
  const cleaned = message.trim().replace(/^['"\u201c]|['"\u201d]$/g, "").trim();
  const fromDocumentPage =
    /^(?:flag|mark|create|add)\s+(.+?)\s+(?:as\s+)?(?:an?\s+)?roadblock\s+from\s+(?:the\s+)?(?:file\s+)?(.+?)\s+page\s+(\d+)\s*[:\-]\s*(.+)$/i.exec(
      cleaned
    );
  if (fromDocumentPage) {
    const taskName = cleanAnchorName(fromDocumentPage[1]);
    const fileName = cleanAnchorName(fromDocumentPage[2]);
    const pageNumber = Number(fromDocumentPage[3]);
    const note = cleanControlText(fromDocumentPage[4]);
    if (taskName && fileName && note && Number.isFinite(pageNumber)) {
      return {
        toolName: "proposeRoadblockChange",
        input: { taskName, note, fileName, pageNumber },
      };
    }
  }

  const fromDocument =
    /^(?:flag|mark|create|add)\s+(.+?)\s+(?:as\s+)?(?:an?\s+)?roadblock\s+from\s+(?:the\s+)?(?:file\s+)?(.+?)\s*[:\-]\s*(.+)$/i.exec(
      cleaned
    );
  if (!fromDocument) return null;
  const taskName = cleanAnchorName(fromDocument[1]);
  const fileName = cleanAnchorName(fromDocument[2]);
  const note = cleanControlText(fromDocument[3]);
  if (!taskName || !fileName || !note) return null;
  return { toolName: "proposeRoadblockChange", input: { taskName, note, fileName } };
}

export function isRoadblockActionRequest(message: string) {
  return ROADBLOCK_ACTION.test(message) && ROADBLOCK_SUBJECT.test(message);
}

export function isTaskActionRequest(message: string) {
  const trimmed = message.trim();
  if (READ_ONLY_OPENING.test(trimmed) || ROADBLOCK_SUBJECT.test(trimmed)) return false;
  return TASK_ACTION.test(trimmed) && (TASK_SUBJECT.test(trimmed) || DIRECT_TASK_ACTION.test(trimmed));
}

export function isTaskProgressActionRequest(message: string) {
  const trimmed = message.trim();
  if (READ_ONLY_OPENING.test(trimmed) || ROADBLOCK_SUBJECT.test(trimmed)) return false;
  return TASK_PROGRESS_ACTION.test(trimmed) && TASK_PROGRESS_SUBJECT.test(trimmed);
}

export function isWeeklyCommitmentActionRequest(message: string) {
  const trimmed = message.trim();
  if (READ_ONLY_OPENING.test(trimmed)) return false;
  return WEEKLY_COMMITMENT_ACTION.test(trimmed) && WEEKLY_COMMITMENT_SUBJECT.test(trimmed);
}

export function isScheduleImpactActionRequest(message: string) {
  const trimmed = message.trim();
  if (READ_ONLY_OPENING.test(trimmed)) return false;
  return SCHEDULE_IMPACT_ACTION.test(trimmed) && SCHEDULE_IMPACT_SUBJECT.test(trimmed);
}

export function isBaselineActionRequest(message: string) {
  const trimmed = message.trim();
  if (READ_ONLY_OPENING.test(trimmed)) return false;
  return BASELINE_ACTION.test(trimmed) && BASELINE_SUBJECT.test(trimmed);
}

export function isScheduleActionRequest(message: string) {
  const trimmed = message.trim();
  if (WHAT_IF_SCHEDULE.test(trimmed)) return true;
  if (READ_ONLY_OPENING.test(trimmed)) return false;
  return (
    (DEPENDENCY_ACTION.test(trimmed) && DEPENDENCY_SUBJECT.test(trimmed)) ||
    (SHIFT_ACTION.test(trimmed) && BULK_SHIFT_SUBJECT.test(trimmed))
  );
}

export function isRfiActionRequest(message: string) {
  const trimmed = message.trim();
  if (isRfiCreateIntentWithoutQuestion(trimmed) || RFI_QUESTION_SUPPLY.test(trimmed)) return true;
  if (RFI_CREATE_SOFT.test(trimmed) && RFI_SUBJECT.test(trimmed)) return true;
  if (READ_ONLY_OPENING.test(trimmed)) return false;
  return RFI_ACTION.test(trimmed) && RFI_SUBJECT.test(trimmed);
}

export function isRfiCreateIntentWithoutQuestion(message: string) {
  const cleaned = message.trim().replace(/[.!?]+$/g, "").trim();
  return (
    /^(?:i\s+(?:just\s+)?(?:want|need|would like)\s+to\s+)?(?:create|file|open|raise|record|submit)\s+(?:an?\s+)?(?:new\s+)?rfi$/i.test(
      cleaned
    ) || /^i\s+want\s+to\s+submit\s+(?:an?\s+)?rfi$/i.test(cleaned)
  );
}

export function isAwaitingRfiQuestion(previousAssistantText: string) {
  if (!/\bRFI\b/i.test(previousAssistantText)) return false;
  return (
    /\b(question|topic)\b/i.test(previousAssistantText) &&
    /\b(what|which|provide|tell|reply|send|exact)\b/i.test(previousAssistantText)
  );
}

export function isRfiTaskListRequest(message: string, previousAssistantText = "") {
  const trimmed = message.trim();
  if (!RFI_TASK_LIST_REQUEST.test(trimmed)) return false;
  return /\bRFI\b/i.test(previousAssistantText) || /\bRFI\b/i.test(trimmed) || /\blink\b/i.test(trimmed);
}

export function parseRfiQuestionFollowUp(
  message: string,
  previousAssistantText: string
): DeterministicProjectControlAction | null {
  if (!isAwaitingRfiQuestion(previousAssistantText)) return null;
  if (isRfiTaskListRequest(message, previousAssistantText)) return null;
  if (isRfiCreateIntentWithoutQuestion(message)) return null;
  if (AFFIRMATIVE_REPLY.test(message.trim())) return null;

  const direct = parseDeterministicProjectControlAction(message);
  if (direct?.toolName === "proposeRfiChange" && direct.input.operation === "CREATE") return direct;

  const supplied = RFI_QUESTION_SUPPLY.exec(message.trim());
  const raw = supplied?.[1] ?? message.trim();
  const question = cleanControlText(raw);
  if (!question || question.length < 2) return null;
  if (
    /^(which|what|where|how|list|show|give|tell)\b/i.test(question) &&
    /\b(rfi|proposal|card|task options?|options?|happened in (?:the )?rfi)\b/i.test(question)
  ) {
    return null;
  }
  return { toolName: "proposeRfiChange", input: { operation: "CREATE", question } };
}

export function isSubmittalActionRequest(message: string) {
  const trimmed = message.trim();
  if (READ_ONLY_OPENING.test(trimmed)) return false;
  return SUBMITTAL_ACTION.test(trimmed) && SUBMITTAL_SUBJECT.test(trimmed);
}

export function isMissingRoadblockProposalConfirmation(message: string, previousAssistantText: string) {
  return (
    AFFIRMATIVE_REPLY.test(message.trim()) &&
    /\bproposal\b/i.test(previousAssistantText) &&
    /\broadblock\b/i.test(previousAssistantText)
  );
}

export function isMissingTaskProposalConfirmation(message: string, previousAssistantText: string) {
  return (
    AFFIRMATIVE_REPLY.test(message.trim()) &&
    /\bproposal\b/i.test(previousAssistantText) &&
    /\b(task|activity|schedule)\b/i.test(previousAssistantText)
  );
}

export function isMissingScheduleProposalConfirmation(message: string, previousAssistantText: string) {
  return (
    AFFIRMATIVE_REPLY.test(message.trim()) &&
    /\bproposal\b/i.test(previousAssistantText) &&
    /\b(dependency|schedule|shift|reflow|what-if)\b/i.test(previousAssistantText)
  );
}

export function isMissingProjectControlProposalConfirmation(message: string, previousAssistantText: string) {
  return (
    AFFIRMATIVE_REPLY.test(message.trim()) &&
    /\bproposal\b/i.test(previousAssistantText) &&
    /\b(RFI|submittal)\b/i.test(previousAssistantText)
  );
}
