/** Helpers for mapping Autodesk ACC files into native Drawing records. */

export function autodeskDrawingTitle(fileName: string): string {
  const trimmed = fileName.trim();
  if (!trimmed) return "ACC Drawing";
  return trimmed.replace(/\.pdf$/i, "");
}

export function autodeskDisciplineFromName(fileName: string): string | null {
  const base = autodeskDrawingTitle(fileName);
  const match = base.match(/^([A-Z]{1,3})[-\s]/);
  return match?.[1] ?? null;
}
