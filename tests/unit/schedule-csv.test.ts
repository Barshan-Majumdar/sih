import { describe, it, expect } from "vitest";
import {
  SCHEDULE_CSV_TEMPLATE,
  normalizeTaskName,
  parseCsvGrid,
  parseScheduleCsv,
  type ScheduleCsvContext,
} from "@/lib/schedule-csv";

const HEADER = "Task Name,Assignee Email,Start Date,End Date,Status,Progress %,Predecessors";

const CONTEXT: ScheduleCsvContext = {
  members: [
    { id: "m1", email: "super@example.com", name: "Sam Super" },
    { id: "m2", email: "Grading@Example.com", name: "Gina Grading" },
  ],
  existingTasks: [
    { id: "t1", name: "Site Mobilization" },
    { id: "t2", name: "Permit Approval" },
  ],
};

/** Builds a file from the canonical header plus the given data lines. */
function file(...lines: string[]): string {
  return [HEADER, ...lines].join("\n");
}

/** All messages attached to the row on `lineNumber`, or [] when the row is valid. */
function messagesOn(text: string, lineNumber: number, context: ScheduleCsvContext = CONTEXT): string[] {
  const result = parseScheduleCsv(text, context);
  return result.errors.find((e) => e.lineNumber === lineNumber)?.messages ?? [];
}

describe("parseCsvGrid", () => {
  it("splits a simple grid", () => {
    expect(parseCsvGrid("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("keeps commas inside quoted fields", () => {
    expect(parseCsvGrid('a,"b,c",d')).toEqual([["a", "b,c", "d"]]);
  });

  it("keeps newlines inside quoted fields", () => {
    expect(parseCsvGrid('a,"line one\nline two",c')).toEqual([["a", "line one\nline two", "c"]]);
  });

  it('treats "" inside a quoted field as one literal quote', () => {
    expect(parseCsvGrid('a,"say ""hi"" now",c')).toEqual([["a", 'say "hi" now', "c"]]);
  });

  it("handles CRLF and bare CR line endings", () => {
    expect(parseCsvGrid("a,b\r\nc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(parseCsvGrid("a,b\rc,d")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(parseCsvGrid('"a\r\nb",c')).toEqual([["a\r\nb", "c"]]);
  });

  it("strips a leading UTF-8 BOM", () => {
    expect(parseCsvGrid("﻿Task Name,Status")).toEqual([["Task Name", "Status"]]);
  });

  it("takes unquoted fields literally, including stray quotes", () => {
    expect(parseCsvGrid('a,b"c,d')).toEqual([["a", 'b"c', "d"]]);
  });

  it("returns every physical row including blank ones so line numbers stay accurate", () => {
    expect(parseCsvGrid("a,b\n\nc,d\n")).toEqual([["a", "b"], [""], ["c", "d"]]);
  });

  it("returns an empty grid for empty text", () => {
    expect(parseCsvGrid("")).toEqual([]);
    expect(parseCsvGrid("﻿")).toEqual([]);
  });

  it("closes an unterminated quoted field at end of input", () => {
    expect(parseCsvGrid('a,"unterminated')).toEqual([["a", "unterminated"]]);
  });
});

describe("normalizeTaskName", () => {
  it("trims, collapses internal whitespace, and lowercases", () => {
    expect(normalizeTaskName("  Footing   Pour ")).toBe("footing pour");
    expect(normalizeTaskName("EXCAVATION")).toBe("excavation");
    expect(normalizeTaskName("Foot\ting\n Pour")).toBe("foot ing pour");
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeTaskName("   ")).toBe("");
  });
});

describe("parseScheduleCsv headers", () => {
  it("parses the shipped template without errors", () => {
    const context: ScheduleCsvContext = {
      members: [
        { id: "m1", email: "super@example.com", name: "Sam" },
        { id: "m2", email: "grading@example.com", name: "Gina" },
        { id: "m3", email: "concrete@example.com", name: "Carl" },
      ],
      existingTasks: [],
    };
    const result = parseScheduleCsv(SCHEDULE_CSV_TEMPLATE, context);
    expect(result.fatalError).toBeNull();
    expect(result.errors).toEqual([]);
    expect(result.summary).toEqual({ total: 5, toCreate: 5, toUpdate: 0, errorCount: 0 });
    expect(result.rows.map((r) => r.name)).toEqual([
      "Site Mobilization",
      "Excavation",
      "Footing Formwork",
      "Footing Pour",
      "Backfill & Compaction",
    ]);
  });

  it("matches header columns out of order, case-insensitively, and ignores extras", () => {
    const text = [
      "Notes,STATUS, task name ,Progress %,end date,Predecessors,Start Date,ASSIGNEE  email,Owner",
      "ignored,In Progress,Excavation,40,2026-10-17,,2026-10-06,grading@example.com,someone",
    ].join("\n");
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.fatalError).toBeNull();
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      name: "Excavation",
      status: "IN_PROGRESS",
      progress: 40,
      startDate: "2026-10-06",
      endDate: "2026-10-17",
      assigneeMemberId: "m2",
    });
  });

  it("reports every missing required column in one fatal error", () => {
    const text = ["Task Name,Assignee Email,End Date,Progress %,Predecessors", "Excavation,,2026-10-17,40,"].join("\n");
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.fatalError).toBe("Missing required column(s): Start Date, Status");
    expect(result.rows).toEqual([]);
  });

  it("is fatal for an empty file, a whitespace-only file, and a header-only file", () => {
    for (const text of ["", "   \n\n", HEADER, `${HEADER}\n\n\n`]) {
      const result = parseScheduleCsv(text, CONTEXT);
      expect(result.fatalError).toBe("The file has no task rows.");
      expect(result.rows).toEqual([]);
      expect(result.summary.total).toBe(0);
    }
  });

  it("finds the header on the first non-blank row and tolerates a BOM", () => {
    const text = `﻿\n${HEADER}\nExcavation,,2026-10-06,2026-10-17,,,`;
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.fatalError).toBeNull();
    expect(result.rows[0].lineNumber).toBe(3);
  });
});

describe("parseScheduleCsv line numbers", () => {
  it("numbers the first data row 2 and skips blank rows silently", () => {
    const text = file("Excavation,,2026-10-06,2026-10-17,,,", "", "Footing Pour,,2026-10-20,2026-10-28,,,", "");
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.errors).toEqual([]);
    expect(result.rows.map((r) => r.lineNumber)).toEqual([2, 4]);
    expect(result.summary.total).toBe(2);
  });

  it("counts physical lines, so a quoted newline shifts later rows", () => {
    const text = file('"Excavation\nphase two",,2026-10-06,2026-10-17,,,', "Footing Pour,,2026-10-20,2026-10-28,,,");
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.rows.map((r) => r.lineNumber)).toEqual([2, 4]);
    expect(result.rows[0].name).toBe("Excavation\nphase two");
  });
});

describe("parseScheduleCsv task name", () => {
  it("requires a task name", () => {
    const text = file("   ,,2026-10-06,2026-10-17,,,");
    expect(messagesOn(text, 2)).toEqual(["Task Name is required"]);
    expect(parseScheduleCsv(text, CONTEXT).errors[0].taskName).toBeNull();
  });

  it("caps the task name at 200 characters after trimming", () => {
    const ok = "a".repeat(200);
    const tooLong = "a".repeat(201);
    expect(messagesOn(file(`  ${ok}  ,,2026-10-06,2026-10-17,,,`), 2)).toEqual([]);
    expect(messagesOn(file(`${tooLong},,2026-10-06,2026-10-17,,,`), 2)).toEqual([
      "Task Name must be 200 characters or fewer",
    ]);
  });
});

describe("parseScheduleCsv assignee", () => {
  it("leaves a blank assignee unassigned", () => {
    const row = parseScheduleCsv(file("Excavation,  ,2026-10-06,2026-10-17,,,"), CONTEXT).rows[0];
    expect(row.assigneeMemberId).toBeNull();
    expect(row.assigneeEmail).toBeNull();
  });

  it("matches a member email case-insensitively and trimmed", () => {
    const row = parseScheduleCsv(file("Excavation, GRADING@example.com ,2026-10-06,2026-10-17,,,"), CONTEXT).rows[0];
    expect(row.assigneeMemberId).toBe("m2");
    expect(row.assigneeEmail).toBe("Grading@Example.com");
  });

  it("rejects an email that belongs to no project member", () => {
    expect(messagesOn(file("Excavation,grading@acme.com,2026-10-06,2026-10-17,,,"), 2)).toEqual([
      'No project member has the email "grading@acme.com"',
    ]);
  });
});

describe("parseScheduleCsv dates", () => {
  it("accepts ISO and US formats and normalizes both to ISO", () => {
    const rows = parseScheduleCsv(
      file("A,,2026-10-06,2026-10-17,,,", "B,,3/7/2026,12/25/2026,,,", "C,,03/07/2026,2026-12-25,,,"),
      CONTEXT
    ).rows;
    expect(rows.map((r) => [r.startDate, r.endDate])).toEqual([
      ["2026-10-06", "2026-10-17"],
      ["2026-03-07", "2026-12-25"],
      ["2026-03-07", "2026-12-25"],
    ]);
  });

  it("requires both dates", () => {
    expect(messagesOn(file("Excavation,,,,,,"), 2)).toEqual(["Start Date is required", "End Date is required"]);
  });

  it("rejects impossible and malformed dates", () => {
    expect(messagesOn(file("A,,13/45/2026,2026-10-17,,,"), 2)).toEqual([
      'Start Date "13/45/2026" is not a valid date (use YYYY-MM-DD)',
    ]);
    expect(messagesOn(file("B,,2026-02-30,2026-10-17,,,"), 2)).toEqual([
      'Start Date "2026-02-30" is not a valid date (use YYYY-MM-DD)',
    ]);
    expect(messagesOn(file("C,,2026-10-06,next tuesday,,,"), 2)).toEqual([
      'End Date "next tuesday" is not a valid date (use YYYY-MM-DD)',
    ]);
  });

  it("accepts a leap day in a leap year and rejects it otherwise", () => {
    expect(messagesOn(file("A,,2024-02-29,2024-03-01,,,"), 2)).toEqual([]);
    expect(messagesOn(file("A,,2026-02-29,2026-03-01,,,"), 2)).toEqual([
      'Start Date "2026-02-29" is not a valid date (use YYYY-MM-DD)',
    ]);
  });

  it("rejects an end date before the start date but allows an equal one", () => {
    expect(messagesOn(file("A,,2026-10-17,2026-10-06,,,"), 2)).toEqual(["End Date must be on or after Start Date"]);
    expect(messagesOn(file("A,,2026-10-06,2026-10-06,,,"), 2)).toEqual([]);
  });

  it("does not compare dates when one of them failed to parse", () => {
    expect(messagesOn(file("A,,not-a-date,2026-10-06,,,"), 2)).toEqual([
      'Start Date "not-a-date" is not a valid date (use YYYY-MM-DD)',
    ]);
  });
});

describe("parseScheduleCsv status", () => {
  it("defaults a blank status to NOT_STARTED", () => {
    expect(parseScheduleCsv(file("A,,2026-10-06,2026-10-17,  ,,"), CONTEXT).rows[0].status).toBe("NOT_STARTED");
  });

  it("accepts every spelling variant of the four statuses", () => {
    const spellings: Array<[string, string]> = [
      ["In Progress", "IN_PROGRESS"],
      ["in-progress", "IN_PROGRESS"],
      ["IN_PROGRESS", "IN_PROGRESS"],
      [" in   progress ", "IN_PROGRESS"],
      ["not started", "NOT_STARTED"],
      ["Not-Started", "NOT_STARTED"],
      ["done", "DONE"],
      ["Delayed", "DELAYED"],
    ];
    for (const [input, expected] of spellings) {
      const rows = parseScheduleCsv(file(`A,,2026-10-06,2026-10-17,${input},,`), CONTEXT).rows;
      expect(rows[0]?.status, input).toBe(expected);
    }
  });

  it("rejects an unknown status", () => {
    expect(messagesOn(file("A,,2026-10-06,2026-10-17,Blocked,,"), 2)).toEqual([
      'Status "Blocked" must be one of NOT_STARTED, IN_PROGRESS, DONE, DELAYED',
    ]);
  });
});

describe("parseScheduleCsv progress", () => {
  it("defaults a blank progress to 0", () => {
    expect(parseScheduleCsv(file("A,,2026-10-06,2026-10-17,,,"), CONTEXT).rows[0].progress).toBe(0);
  });

  it("accepts plain, percent-suffixed, and clean-decimal numbers", () => {
    for (const input of ["40", "40%", " 40 % ", "40.0"]) {
      const rows = parseScheduleCsv(file(`A,,2026-10-06,2026-10-17,,${input},`), CONTEXT).rows;
      expect(rows[0]?.progress, input).toBe(40);
    }
    expect(parseScheduleCsv(file("A,,2026-10-06,2026-10-17,,100,"), CONTEXT).rows[0].progress).toBe(100);
  });

  it("rejects fractions, out-of-range values, and non-numbers", () => {
    for (const input of ["40.5", "101", "-1", "abc", "%"]) {
      expect(messagesOn(file(`A,,2026-10-06,2026-10-17,,${input},`), 2), input).toEqual([
        "Progress % must be a whole number between 0 and 100",
      ]);
    }
  });
});

describe("parseScheduleCsv predecessors", () => {
  it("defaults to no predecessors", () => {
    expect(parseScheduleCsv(file("A,,2026-10-06,2026-10-17,,,"), CONTEXT).rows[0].predecessorNames).toEqual([]);
  });

  it("resolves a predecessor against another row in the same file", () => {
    const text = file("Excavation,,2026-10-06,2026-10-17,,,", "Footing Pour,,2026-10-20,2026-10-28,,,  excavation ");
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.errors).toEqual([]);
    expect(result.rows[1].predecessorNames).toEqual(["Excavation"]);
  });

  it("resolves a predecessor against an existing project task, using the stored spelling", () => {
    const result = parseScheduleCsv(file("Excavation,,2026-10-06,2026-10-17,,,permit  APPROVAL"), CONTEXT);
    expect(result.errors).toEqual([]);
    expect(result.rows[0].predecessorNames).toEqual(["Permit Approval"]);
  });

  it("splits on semicolons, trims entries, and drops empty ones", () => {
    const text = file(
      "Excavation,,2026-10-06,2026-10-17,,,",
      'Footing Pour,,2026-10-20,2026-10-28,,,"Excavation; ;Permit Approval;"'
    );
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.errors).toEqual([]);
    expect(result.rows[1].predecessorNames).toEqual(["Excavation", "Permit Approval"]);
  });

  it("rejects a predecessor that matches nothing in the file or the project", () => {
    expect(messagesOn(file("Excavation,,2026-10-06,2026-10-17,,,Foo"), 2)).toEqual([
      'Predecessor "Foo" does not match any task in this file or in the project',
    ]);
  });

  it("rejects a row that lists itself", () => {
    expect(messagesOn(file("Excavation,,2026-10-06,2026-10-17,,, excavation "), 2)).toEqual([
      "A task cannot be its own predecessor",
    ]);
  });

  it("flags every row on a three-node cycle", () => {
    const text = file(
      "A,,2026-10-06,2026-10-17,,,C",
      "B,,2026-10-06,2026-10-17,,,A",
      "C,,2026-10-06,2026-10-17,,,B",
      "D,,2026-10-06,2026-10-17,,,A"
    );
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.errors.map((e) => e.lineNumber)).toEqual([2, 3, 4]);
    for (const error of result.errors) {
      expect(error.messages).toEqual(["Predecessors form a circular dependency"]);
    }
    expect(result.rows.map((r) => r.name)).toEqual(["D"]);
  });
});

describe("parseScheduleCsv cross-row rules", () => {
  it("flags duplicate task names on every involved line", () => {
    const text = file(
      "Excavation,,2026-10-06,2026-10-17,,,",
      "Footing Pour,,2026-10-20,2026-10-28,,,",
      "  excavation,,2026-10-06,2026-10-17,,,"
    );
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.errors.map((e) => e.lineNumber)).toEqual([2, 4]);
    expect(result.errors[0].messages).toEqual(['Duplicate Task Name "Excavation" also appears on line 4']);
    expect(result.errors[1].messages).toEqual(['Duplicate Task Name "excavation" also appears on line 2']);
    expect(result.rows.map((r) => r.name)).toEqual(["Footing Pour"]);
  });

  it("names every other line when a task name appears three times", () => {
    const text = file(
      "Excavation,,2026-10-06,2026-10-17,,,",
      "Excavation,,2026-10-06,2026-10-17,,,",
      "Excavation,,2026-10-06,2026-10-17,,,"
    );
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.errors[0].messages).toEqual(['Duplicate Task Name "Excavation" also appears on lines 3, 4']);
    expect(result.errors[2].messages).toEqual(['Duplicate Task Name "Excavation" also appears on lines 2, 3']);
  });

  it("accumulates every problem on a single row", () => {
    const text = file("A,nobody@acme.com,2026-13-01,2026-10-17,Blocked,150,Ghost");
    expect(messagesOn(text, 2)).toEqual([
      'No project member has the email "nobody@acme.com"',
      'Start Date "2026-13-01" is not a valid date (use YYYY-MM-DD)',
      'Status "Blocked" must be one of NOT_STARTED, IN_PROGRESS, DONE, DELAYED',
      "Progress % must be a whole number between 0 and 100",
      'Predecessor "Ghost" does not match any task in this file or in the project',
    ]);
  });
});

describe("parseScheduleCsv output", () => {
  it("marks rows matching an existing task as updates and the rest as creates", () => {
    const text = file(
      " site   mobilization ,,2026-10-01,2026-10-05,DONE,100,",
      "Excavation,,2026-10-06,2026-10-17,IN_PROGRESS,40,Site Mobilization"
    );
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.rows[0]).toMatchObject({ action: "update", existingTaskId: "t1", name: "site   mobilization" });
    expect(result.rows[1]).toMatchObject({ action: "create", existingTaskId: null });
    expect(result.summary).toEqual({ total: 2, toCreate: 1, toUpdate: 1, errorCount: 0 });
  });

  it("still returns the valid rows alongside errors so the UI can preview everything", () => {
    const text = file(
      "Excavation,,2026-10-06,2026-10-17,,,",
      "Broken,,not-a-date,2026-10-17,,,",
      "Footing Pour,,2026-10-20,2026-10-28,,,Excavation"
    );
    const result = parseScheduleCsv(text, CONTEXT);
    expect(result.rows.map((r) => r.name)).toEqual(["Excavation", "Footing Pour"]);
    expect(result.summary).toEqual({ total: 3, toCreate: 2, toUpdate: 0, errorCount: 1 });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ lineNumber: 3, taskName: "Broken" });
  });

  it("tolerates short rows by treating missing trailing cells as blank", () => {
    const result = parseScheduleCsv(file("Excavation,,2026-10-06,2026-10-17"), CONTEXT);
    expect(result.errors).toEqual([]);
    expect(result.rows[0]).toMatchObject({ status: "NOT_STARTED", progress: 0, predecessorNames: [] });
  });

  it("never throws on hostile input", () => {
    for (const text of ['"', ",,,,,,", " ", `${HEADER}\n"unclosed,,,,,`]) {
      expect(() => parseScheduleCsv(text, CONTEXT)).not.toThrow();
    }
  });
});
