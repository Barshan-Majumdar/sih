import Link from "next/link";

type AgiraHeroProps = {
  isSignedIn: boolean;
};

export function AgiraHero({ isSignedIn }: AgiraHeroProps) {
  return (
    <section id="hero" className="border-b border-hairline bg-app-bg">
      <div className="mx-auto grid max-w-[1400px] gap-14 px-6 pb-20 pt-40 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-12 lg:pb-28 lg:pt-48">
        <div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">
            Construction operations
          </p>
          <h1 className="font-display max-w-[15ch] text-4xl leading-[1.05] tracking-[-0.02em] text-ink sm:text-5xl lg:text-6xl">
            Every commitment, cited and reversible.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-body sm:text-lg">
            One control room for the schedule, the field, and the documents.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={isSignedIn ? "/projects" : "/sign-up"}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-active"
            >
              {isSignedIn ? "Open your projects" : "Get started free"}
              <span aria-hidden>→</span>
            </Link>
            <a
              href="#why"
              className="inline-flex h-11 items-center justify-center rounded-md border border-hairline px-5 text-sm font-semibold text-ink transition-colors hover:bg-surface-soft"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="absolute -right-4 -top-4 hidden h-full w-full rounded-lg border border-hairline bg-surface-card sm:block"
          />
          <WeeklyPlanPanel />
        </div>
      </div>
    </section>
  );
}

const COMMITMENTS = [
  { task: "Rough electrical wiring - Level 2", owner: "Tom Electric", initials: "TE", status: "On track", tone: "success" },
  { task: "Pass plumbing pressure test", owner: "Sara Plumbing", initials: "SP", status: "At risk", tone: "error" },
  { task: "Install corridor embeds", owner: "Jane GC", initials: "JG", status: "Committed", tone: "brand" },
] as const;

const TONE_CLASS: Record<(typeof COMMITMENTS)[number]["tone"], string> = {
  success: "bg-success",
  error: "bg-error",
  brand: "bg-brand-accent",
};

const HEALTH_TREND = [46, 58, 52, 66, 74, 82] as const;

function WeeklyPlanPanel() {
  return (
    <div className="relative overflow-hidden rounded-lg border border-hairline bg-canvas shadow-[0_20px_50px_rgba(16,23,32,0.08)]">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-hairline bg-surface-dark px-5 text-on-dark">
        <div>
          <p className="text-xs font-semibold">Weekly Work Plan</p>
          <p className="mt-0.5 text-[10px] text-on-dark-soft">Week of Jul 13 - Harborview Residences</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-on-dark-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-hairline border-b border-hairline bg-surface-soft">
        <div className="px-4 py-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted">Health</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <span className="text-2xl font-semibold text-ink">82</span>
            <span className="flex h-6 items-end gap-0.5" aria-hidden>
              {HEALTH_TREND.map((value, index) => (
                <span
                  key={index}
                  className={`w-1 rounded-sm ${
                    index === HEALTH_TREND.length - 1 ? "bg-brand-accent" : "bg-surface-strong"
                  }`}
                  style={{ height: `${value}%` }}
                />
              ))}
            </span>
          </div>
        </div>
        <div className="px-4 py-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted">PPC</p>
          <p className="mt-2 text-2xl font-semibold text-ink">75%</p>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-surface-card" aria-hidden>
            <div className="h-1.5 rounded-full bg-brand-accent" style={{ width: "75%" }} />
          </div>
        </div>
        <div className="px-4 py-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted">Open risk</p>
          <p className="mt-2 text-2xl font-semibold text-ink">1</p>
          <p className="mt-2.5 text-[10px] font-semibold text-error">-2d variance</p>
        </div>
      </div>

      <ul className="divide-y divide-hairline-soft">
        {COMMITMENTS.map((row) => (
          <li key={row.task} className="flex items-start gap-3 px-5 py-4">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-card text-[10px] font-bold text-body">
              {row.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{row.task}</p>
              <p className="mt-1 text-xs text-muted">{row.owner}</p>
            </div>
            <span className="mt-1 flex shrink-0 items-center gap-2 text-xs font-medium text-body">
              <span className={`h-2 w-2 rounded-full ${TONE_CLASS[row.tone]}`} />
              {row.status}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-hairline bg-surface-soft px-5 py-3 text-xs font-medium text-muted">
        <span>2 Agent proposals open for review</span>
        <span aria-hidden className="font-semibold text-brand-accent">
          →
        </span>
      </div>
    </div>
  );
}
