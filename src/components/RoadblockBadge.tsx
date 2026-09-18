export function RoadblockBadge({ status }: { status: "OPEN" | "RESOLVED" }) {
  if (status === "OPEN") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-error/10 px-2.5 py-1 text-xs font-semibold text-error">
        <span className="h-1.5 w-1.5 rounded-full bg-error" aria-hidden />
        Roadblock
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
      <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
      Resolved
    </span>
  );
}
