import type { FileUIPart, UIMessage } from "ai";

export const MAX_ASSISTANT_ATTACHMENTS = 4;
export const MAX_ASSISTANT_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const ASSISTANT_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export function isAllowedAssistantAttachmentType(mediaType: string): boolean {
  return ASSISTANT_ATTACHMENT_TYPES.includes(
    mediaType as (typeof ASSISTANT_ATTACHMENT_TYPES)[number]
  );
}

export function assistantFileParts(message: UIMessage): FileUIPart[] {
  return message.parts.filter((part): part is FileUIPart => part.type === "file");
}

export function formatAttachmentBytes(sizeBytes: number): string {
  if (sizeBytes < 1024 * 1024) return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function buildAttachmentAcknowledgement(
  question: string,
  fileNames: string[],
  projectName: string
): string | null {
  if (fileNames.length === 0) return null;
  const asksAboutStorage =
    /\b(save|saved|store|stored|upload|uploaded|attach|attached|confirm)\b/i.test(question) &&
    /\b(file|files|attachment|attachments|document|documents|name)\b/i.test(question);
  const asksAboutContents =
    /\b(analy[sz]e|extract|read|review|summari[sz]e)\b/i.test(question) ||
    /\bwhat(?:'s| is) (?:in|inside)\b/i.test(question);
  if (asksAboutContents || !asksAboutStorage) return null;

  const quotedNames = fileNames.map((fileName) => `"${fileName}"`);
  const nameList =
    quotedNames.length === 1
      ? quotedNames[0]
      : `${quotedNames.slice(0, -1).join(", ")} and ${quotedNames.at(-1)}`;
  const subject = fileNames.length === 1 ? nameList : `${fileNames.length} files: ${nameList}`;
  const verb = fileNames.length === 1 ? "is" : "are";
  const stored = `${subject} ${verb} saved securely to ${projectName} and attached to this conversation.`;

  return `${stored} ${fileNames.length === 1 ? "Its attachment name is" : "The attachment names are"} ${nameList}.`;
}
