import { describe, expect, it } from "vitest";
import {
  isMissingRoadblockProposalConfirmation,
  isMissingScheduleProposalConfirmation,
  isMissingTaskProposalConfirmation,
  isRoadblockActionRequest,
  isRfiActionRequest,
  isRfiCreateIntentWithoutQuestion,
  isRfiTaskListRequest,
  isScheduleActionRequest,
  isScheduleImpactActionRequest,
  isSubmittalActionRequest,
  isTaskActionRequest,
  isTaskProgressActionRequest,
  isBaselineActionRequest,
  isWeeklyCommitmentActionRequest,
  isAwaitingRfiQuestion,
  parseDeterministicBaselineAction,
  parseDeterministicRoadblockAction,
  parseDeterministicProjectControlAction,
  parseDeterministicScheduleWhatIf,
  parseDeterministicScheduleImpactAction,
  parseDeterministicTaskProgressAction,
  parseDeterministicWeeklyCommitmentAction,
  parseRfiQuestionFollowUp,
} from "@/lib/assistant-intent";
import { rankTaskNameMatches } from "@/lib/assistant-tools";

describe("rankTaskNameMatches", () => {
  const tasks = [
    { name: "Rough electrical wiring" },
    { name: "Rough plumbing install" },
    { name: "Electrical panel inspection" },
    { name: "Site prep & excavation" },
    { name: "Drywall installation" },
  ];

  it("returns an exact task first", () => {
    const matches = rankTaskNameMatches(tasks, "Electrical panel inspection");
    expect(matches[0]).toMatchObject({ task: tasks[2], score: 1 });
  });

  it("returns useful suggestions when only part of the requested task exists", () => {
    const matches = rankTaskNameMatches(tasks, "Foundation inspection");
    expect(matches.map(({ task }) => task.name)).toEqual(["Electrical panel inspection"]);
  });

  it("does not suggest unrelated tasks", () => {
    expect(rankTaskNameMatches(tasks, "Concrete pour")).toEqual([]);
  });
});

describe("isRoadblockActionRequest", () => {
  it("detects roadblock mutation requests", () => {
    expect(isRoadblockActionRequest("Add a roadblock to Rough electrical wiring")).toBe(true);
    expect(isRoadblockActionRequest("Change the roadblock owner to Sam")).toBe(true);
  });

  it("does not force proposal tools for read-only questions", () => {
    expect(isRoadblockActionRequest("Which roadblocks are still open?")).toBe(false);
    expect(isRoadblockActionRequest("Why is this task blocked? ")).toBe(false);
  });
});

describe("isMissingRoadblockProposalConfirmation", () => {
  it("recovers an affirmative reply after a missing roadblock proposal card", () => {
    expect(
      isMissingRoadblockProposalConfirmation(
        "yes do it",
        "I prepared a proposal to flag the roadblock. Please confirm the proposal card."
      )
    ).toBe(true);
  });

  it("does not treat unrelated confirmations as roadblock actions", () => {
    expect(isMissingRoadblockProposalConfirmation("yes", "I found three open RFIs.")).toBe(false);
  });
});

describe("isTaskActionRequest", () => {
  it("detects consolidated task edits and task creation", () => {
    expect(isTaskActionRequest("Create a task called Level 2 framing from July 20 to July 24")).toBe(true);
    expect(isTaskActionRequest("Move Rough electrical wiring to July 22 and set progress to 40%"))
      .toBe(true);
  });

  it("leaves schedule questions read-only", () => {
    expect(isTaskActionRequest("Which tasks should move next week?")).toBe(false);
    expect(isTaskActionRequest("Show task progress")).toBe(false);
  });
});

describe("isMissingTaskProposalConfirmation", () => {
  it("recovers a missing task proposal", () => {
    expect(
      isMissingTaskProposalConfirmation(
        "go ahead",
        "I prepared a task proposal. Review the proposal card to update the schedule."
      )
    ).toBe(true);
  });
});

describe("task progress and weekly commitment intent", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");

  it("detects and parses task progress updates", () => {
    expect(isTaskProgressActionRequest("Mark Rough electrical wiring 80% complete")).toBe(true);
    expect(isTaskProgressActionRequest("Show task progress")).toBe(false);
    expect(parseDeterministicTaskProgressAction("Mark Rough electrical wiring 80% complete", now)).toEqual({
      toolName: "proposeTaskProgressChange",
      input: {
        taskName: "Rough electrical wiring",
        status: "IN_PROGRESS",
        progress: 80,
      },
    });
  });

  it("parses explicit task status changes without including the word status in the task name", () => {
    expect(parseDeterministicTaskProgressAction("Update Rough electrical wiring status to delayed", now)).toEqual({
      toolName: "proposeTaskProgressChange",
      input: {
        taskName: "Rough electrical wiring",
        status: "DELAYED",
      },
    });
    expect(parseDeterministicTaskProgressAction("Mark Rough electrical wiring as in progress", now)).toEqual({
      toolName: "proposeTaskProgressChange",
      input: {
        taskName: "Rough electrical wiring",
        status: "IN_PROGRESS",
      },
    });
    expect(parseDeterministicTaskProgressAction("Set Rough electrical wiring status to not started", now)).toEqual({
      toolName: "proposeTaskProgressChange",
      input: {
        taskName: "Rough electrical wiring",
        status: "NOT_STARTED",
        progress: 0,
      },
    });
  });

  it("detects and parses weekly commitment actions", () => {
    expect(isWeeklyCommitmentActionRequest("Commit Rough plumbing install for next week")).toBe(true);
    expect(isWeeklyCommitmentActionRequest("Which commitments are late?")).toBe(false);
    expect(parseDeterministicWeeklyCommitmentAction("Commit Rough plumbing install for next week", now)).toEqual({
      toolName: "proposeWeeklyCommitmentChange",
      input: {
        operation: "CREATE",
        taskName: "Rough plumbing install",
        weekStartDate: "2026-07-20",
      },
    });
    expect(
      parseDeterministicWeeklyCommitmentAction(
        "Remove Rough plumbing install from next week's plan because scope changed",
        now
      )
    ).toEqual({
      toolName: "proposeWeeklyCommitmentChange",
      input: {
        operation: "REMOVE",
        taskName: "Rough plumbing install",
        weekStartDate: "2026-07-20",
        removalReason: "scope changed",
      },
    });
    expect(
      parseDeterministicWeeklyCommitmentAction(
        "Mark Rough plumbing install not completed for this week because material late",
        now
      )
    ).toEqual({
      toolName: "proposeWeeklyCommitmentChange",
      input: {
        operation: "UPDATE_STATUS",
        taskName: "Rough plumbing install",
        weekStartDate: "2026-07-13",
        status: "NOT_COMPLETED",
        reasonForVariance: "material late",
      },
    });
    expect(parseDeterministicWeeklyCommitmentAction("Complete Rough plumbing install for this week", now)).toEqual({
      toolName: "proposeWeeklyCommitmentChange",
      input: {
        operation: "UPDATE_STATUS",
        taskName: "Rough plumbing install",
        weekStartDate: "2026-07-13",
        status: "COMPLETED",
      },
    });
    expect(
      parseDeterministicWeeklyCommitmentAction(
        "Set the variance reason for Rough plumbing install for this week to material delivery delayed",
        now
      )
    ).toEqual({
      toolName: "proposeWeeklyCommitmentChange",
      input: {
        operation: "UPDATE_STATUS",
        taskName: "Rough plumbing install",
        weekStartDate: "2026-07-13",
        status: "NOT_COMPLETED",
        reasonForVariance: "material delivery delayed",
      },
    });
  });
});

describe("schedule impact and baseline intent", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");

  it("detects and parses schedule impact request creation", () => {
    const prompt =
      "Create a schedule impact request for Rough plumbing install: inspection delay may push finish to 2026-08-15";
    expect(isScheduleImpactActionRequest(prompt)).toBe(true);
    // Generic "create" also looks like a task action; chat routing must prefer the SIR tool.
    expect(isTaskActionRequest(prompt)).toBe(true);
    expect(parseDeterministicScheduleImpactAction(prompt, now)).toEqual({
      toolName: "proposeScheduleImpactChange",
      input: {
        operation: "CREATE",
        taskName: "Rough plumbing install",
        description: "inspection delay may push finish to 2026-08-15",
        proposedNewEndDate: "2026-08-15",
      },
    });
  });

  it("detects and parses schedule impact request review", () => {
    expect(isScheduleImpactActionRequest("Approve the schedule impact request rain delay")).toBe(true);
    expect(
      parseDeterministicScheduleImpactAction(
        "Approve the schedule impact request rain delay because weather log confirms",
        now
      )
    ).toEqual({
      toolName: "proposeScheduleImpactChange",
      input: {
        operation: "REVIEW",
        description: "rain delay",
        status: "APPROVED",
        reviewNote: "weather log confirms",
      },
    });
    expect(
      parseDeterministicScheduleImpactAction("Reject the SIR owner direction with note: no impact", now)
    ).toEqual({
      toolName: "proposeScheduleImpactChange",
      input: {
        operation: "REVIEW",
        description: "owner direction",
        status: "REJECTED",
        reviewNote: "no impact",
      },
    });
  });

  it("detects and parses baseline creation", () => {
    expect(isBaselineActionRequest("Create a baseline named Manual test baseline")).toBe(true);
    expect(parseDeterministicBaselineAction("Create a baseline named Manual test baseline")).toEqual({
      toolName: "proposeBaselineChange",
      input: { operation: "CREATE", name: "Manual test baseline" },
    });
  });

  it("detects and parses baseline comparison", () => {
    expect(isBaselineActionRequest("Compare schedule to baseline")).toBe(true);
    expect(parseDeterministicBaselineAction("Compare schedule to baseline")).toEqual({
      toolName: "proposeBaselineChange",
      input: { operation: "COMPARE" },
    });
    expect(
      parseDeterministicBaselineAction("Compare current schedule to the baseline named Owner-approved baseline")
    ).toEqual({
      toolName: "proposeBaselineChange",
      input: { operation: "COMPARE", name: "Owner-approved baseline" },
    });
  });
});

describe("isScheduleActionRequest", () => {
  it("detects dependency edits and bulk shifts", () => {
    expect(isScheduleActionRequest("Make drywall installation depend on rough electrical wiring")).toBe(true);
    expect(isScheduleActionRequest("Shift all incomplete tasks by 3 days")).toBe(true);
    expect(isScheduleActionRequest("Move Rough plumbing install and Drywall installation by 2 days")).toBe(true);
    expect(isScheduleActionRequest("What happens if electrical inspection finishes next Friday?")).toBe(true);
    expect(isScheduleActionRequest("Delay the inspection by 3 days and reflow downstream work")).toBe(true);
  });

  it("leaves dependency questions read-only", () => {
    expect(isScheduleActionRequest("Which tasks have dependencies?")).toBe(false);
  });
});

describe("project-controls action intent", () => {
  it("detects RFI and submittal mutations", () => {
    expect(isRfiActionRequest("Raise an RFI for the waterproofing detail")).toBe(true);
    expect(isRfiActionRequest("Answer RFI 17 with the revised elevation")).toBe(true);
    expect(isRfiActionRequest("i want to submit an RFI")).toBe(true);
    expect(isRfiCreateIntentWithoutQuestion("i want to submit an RFI")).toBe(true);
    expect(isRfiActionRequest("my question for new RFI is what happened to it")).toBe(true);
    expect(isSubmittalActionRequest("Approve the storefront submittal")).toBe(true);
    expect(isSubmittalActionRequest("Create a submittal for product data")).toBe(true);
  });

  it("leaves project-controls questions read-only", () => {
    expect(isRfiActionRequest("Which RFIs are still open?")).toBe(false);
    expect(isSubmittalActionRequest("Show pending submittals")).toBe(false);
  });

  it("recovers conversational RFI question supply and task-list asks", () => {
    const awaiting =
      "What question should I put on the new RFI? Reply with the exact question text.";
    expect(isAwaitingRfiQuestion(awaiting)).toBe(true);
    expect(parseRfiQuestionFollowUp("what happened to it", awaiting)).toEqual({
      toolName: "proposeRfiChange",
      input: { operation: "CREATE", question: "what happened to it" },
    });
    expect(
      parseDeterministicProjectControlAction("my question for new RFI is 'what happened to it'")
    ).toEqual({
      toolName: "proposeRfiChange",
      input: { operation: "CREATE", question: "what happened to it" },
    });
    expect(isRfiTaskListRequest("give me all the task options", awaiting)).toBe(true);
    expect(parseRfiQuestionFollowUp("give me all the task options", awaiting)).toBeNull();
  });
});

describe("parseDeterministicProjectControlAction", () => {
  it("parses common RFI commands without an AI provider", () => {
    expect(parseDeterministicProjectControlAction("Raise an RFI asking Which waterproofing detail applies?"))
      .toEqual({
        toolName: "proposeRfiChange",
        input: { operation: "CREATE", question: "Which waterproofing detail applies" },
      });
    expect(parseDeterministicProjectControlAction("Answer RFI slab edge elevation with Use SK-14"))
      .toEqual({
        toolName: "proposeRfiChange",
        input: { operation: "ANSWER", question: "slab edge elevation", answer: "Use SK-14" },
      });
    expect(parseDeterministicProjectControlAction("Close the RFI concrete mix question"))
      .toMatchObject({ input: { operation: "CLOSE" } });
    expect(
      parseDeterministicProjectControlAction(
        'Raise an RFI from "Waterproofing Spec.pdf" page 3: Which membrane termination detail applies?'
      )
    ).toEqual({
      toolName: "proposeRfiChange",
      input: {
        operation: "CREATE",
        question: "Which membrane termination detail applies",
        fileName: "Waterproofing Spec.pdf",
        pageNumber: 3,
      },
    });
    expect(
      parseDeterministicProjectControlAction(
        "Raise an RFI from Waterproofing Spec.pdf asking Which membrane detail applies?"
      )
    ).toEqual({
      toolName: "proposeRfiChange",
      input: {
        operation: "CREATE",
        question: "Which membrane detail applies",
        fileName: "Waterproofing Spec.pdf",
      },
    });
  });

  it("parses common submittal commands without an AI provider", () => {
    expect(parseDeterministicProjectControlAction("Create a submittal for storefront product data"))
      .toEqual({
        toolName: "proposeSubmittalChange",
        input: { operation: "CREATE", title: "storefront product data" },
      });
    expect(parseDeterministicProjectControlAction("Approve the submittal storefront product data"))
      .toMatchObject({ input: { operation: "UPDATE_STATUS", status: "APPROVED" } });
    expect(
      parseDeterministicProjectControlAction(
        'Create a submittal from "Waterproofing Spec.pdf" page 3: Membrane product data'
      )
    ).toEqual({
      toolName: "proposeSubmittalChange",
      input: {
        operation: "CREATE",
        title: "Membrane product data",
        fileName: "Waterproofing Spec.pdf",
        pageNumber: 3,
      },
    });
  });
});

describe("parseDeterministicRoadblockAction", () => {
  it("parses a cited document roadblock without an AI provider", () => {
    expect(
      parseDeterministicRoadblockAction(
        'Flag Rough plumbing install as a roadblock from "Permit Log.pdf" page 2: Permit approval is pending'
      )
    ).toEqual({
      toolName: "proposeRoadblockChange",
      input: {
        taskName: "Rough plumbing install",
        note: "Permit approval is pending",
        fileName: "Permit Log.pdf",
        pageNumber: 2,
      },
    });
  });
});

describe("isMissingScheduleProposalConfirmation", () => {
  it("recovers a missing schedule proposal", () => {
    expect(
      isMissingScheduleProposalConfirmation(
        "confirm",
        "I prepared a schedule shift proposal with dependency impact warnings."
      )
    ).toBe(true);
  });
});

describe("parseDeterministicScheduleWhatIf", () => {
  const now = new Date("2026-07-16T12:00:00.000Z");

  it("parses the human finish-date prompt without an AI provider", () => {
    expect(
      parseDeterministicScheduleWhatIf(
        "\u201cWhat happens if Rough plumbing install finishes on August 5, 2026\u201d",
        now
      )
    ).toEqual({
      operation: "REFLOW_SUCCESSORS",
      anchorTaskName: "Rough plumbing install",
      newEndDate: "2026-08-05",
    });
  });

  it("parses relative delays, earlier moves, and weekdays", () => {
    expect(parseDeterministicScheduleWhatIf("Inspection is delayed by 3 days", now)).toMatchObject({
      anchorTaskName: "Inspection",
      shiftDays: 3,
    });
    expect(parseDeterministicScheduleWhatIf("Move drywall 2 days earlier", now)).toMatchObject({
      anchorTaskName: "drywall",
      shiftDays: -2,
    });
    expect(
      parseDeterministicScheduleWhatIf("What happens if inspection finishes next Friday?", now)
    ).toMatchObject({ newEndDate: "2026-07-17" });
    expect(
      parseDeterministicScheduleWhatIf(
        "What happens if inspection finishes on August 5, 2026 and reflow downstream work?",
        now
      )
    ).toMatchObject({ anchorTaskName: "inspection", newEndDate: "2026-08-05" });
  });
});
