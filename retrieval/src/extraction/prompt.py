"""Extraction prompt construction. Pure string logic, no I/O."""

from typing import Optional

from .schemas import EVENT_TYPES

_SYSTEM_RULES = """You extract structured construction progress events from messy Indian infrastructure field reports.

A single report almost always describes SEVERAL DIFFERENT activities across different piers, spans, chainages or zones. Emit ONE item per distinct activity. Never merge two activities into one item.

For each item:
- raw_text: a self-contained sentence describing only that one activity, rewritten so it stands alone.
- event_type: exactly one of {event_types}.
  STARTED when work begins, COMPLETED when an activity is finished, PAUSED when work stops or is suspended, REWORK when work is redone or repaired, PROGRESS for partial advancement.
- extracted_date: ISO YYYY-MM-DD. Resolve relative dates such as "today" or "yesterday" against the report date. If no date is stated anywhere, use the report date.
- progress_percent: 0 to 100 when the report states a percentage or a completion claim. Use 100 for COMPLETED. Leave null when no percentage can be justified. Never invent a number.
- source_snippet: the verbatim substring of the report that this item came from.

Return only activities that actually happened in the field. Ignore greetings, signatures, headers and weather notes that carry no activity.
Return an empty list if the report contains no construction activity."""


def build_extraction_prompt(report_text: Optional[str], report_date: Optional[str]) -> str:
    rules = _SYSTEM_RULES.format(event_types=", ".join(EVENT_TYPES))
    effective_date = report_date or "unknown"

    parts = [rules, "", f"Report date: {effective_date}", ""]

    if report_text:
        parts.append("Report text:")
        parts.append(report_text)
    else:
        parts.append("The report is in the attached document. Extract from the attached document.")

    return "\n".join(parts)
