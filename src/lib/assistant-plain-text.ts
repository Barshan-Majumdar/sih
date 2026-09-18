/**
 * Strips markdown from LLM replies — the chat UI renders plain text only.
 */
export function stripAssistantMarkdown(text: string): string {
  let s = text.replace(/\r\n/g, "\n");

  s = s.replace(/```[^\n]*\n([\s\S]*?)```/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");

  // Headings: ### Title or ###Title
  s = s.replace(/^[ \t]*#{1,6}[ \t]*/gm, "");

  for (let i = 0; i < 4; i++) {
    s = s.replace(/\*\*\*([^*]+)\*\*\*/g, "$1");
    s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
    s = s.replace(/__([^_]+)__/g, "$1");
    s = s.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1");
    s = s.replace(/(?<!_)_([^_\n]+)_(?!_)/g, "$1");
  }

  s = s.replace(/^[ \t]*[-*+•][ \t]+/gm, "");
  s = s.replace(/^[ \t]*\d+[.)][ \t]+/gm, "");
  s = s.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "");

  // Orphan markdown characters models leave behind
  s = s.replace(/\*\*/g, "");
  s = s.replace(/(?<!\w)\*(?=\s)/g, "");
  s = s.replace(/(?<=\s)\*(?!\w)/g, "");
  s = s.replace(/^\*+[ \t]*/gm, "");

  s = s.replace(/^[ \t]*#+[ \t]*/gm, "");
  s = s.replace(/(^|[ \t])#{2,}(?=[ \t]|$)/g, "$1");

  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}
