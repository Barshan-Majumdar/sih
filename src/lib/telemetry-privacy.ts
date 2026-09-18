export type SafeMetadata = Record<string, unknown>;

const REDACTED = "[REDACTED]";
const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|api[-_]?key|content|prompt|message|body|html)/i;

export function redactText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+=*/gi, `Bearer ${REDACTED}`)
    .replace(/(?:postgres(?:ql)?|mysql):\/\/[^\s]+/gi, REDACTED)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED)
    .slice(0, 2_000);
}

function sanitizeValue(value: unknown, key = "", depth = 0): unknown {
  if (SENSITIVE_KEY.test(key)) return REDACTED;
  if (depth > 4) return "[TRUNCATED]";
  if (value === null || value === undefined || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") return redactText(value);
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return { name: value.name, message: redactText(value.message) };
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeValue(item, key, depth + 1));
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 50)
        .map(([childKey, childValue]) => [childKey, sanitizeValue(childValue, childKey, depth + 1)])
    );
  }
  return String(value).slice(0, 500);
}

export function sanitizeMetadata(metadata: SafeMetadata = {}): SafeMetadata {
  return sanitizeValue(metadata) as SafeMetadata;
}
