import Link from "next/link";

type AgiraHeroProps = {
  isSignedIn: boolean;
};

export function AgiraHero({ isSignedIn }: AgiraHeroProps) {
  return (
    <section id="hero" className="relative overflow-hidden border-b border-hairline bg-app-bg">
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[850px] -translate-x-1/2 rounded-full bg-brand-accent/5 blur-[130px]" aria-hidden />
      <div className="mx-auto grid max-w-[1400px] gap-14 px-6 pb-20 pt-36 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-12 lg:pb-28 lg:pt-44">
        <div>
          <div className="inline-flex items-center gap-2 rounded-pill border border-brand-accent/20 bg-brand-accent/10 px-3 py-1 mb-5">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-accent animate-pulse" aria-hidden />
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">
              Construction Operations OS
            </span>
          </div>
          <h1 className="font-display max-w-[15ch] text-4xl leading-[1.08] tracking-[-0.03em] text-ink sm:text-5xl lg:text-6xl">
            Every commitment, cited and reversible.
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-body sm:text-lg">
            One control room for the schedule, the field, and the project documents — powered by native deterministic intelligence.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href={isSignedIn ? "/projects" : "/sign-up"}
              className="btn-interactive inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-xs font-semibold text-on-primary shadow-[0_4px_14px_rgba(15,23,42,0.18)] transition-all hover:bg-primary-active active:scale-[0.98]"
            >
              {isSignedIn ? "Open your projects" : "Get started free"}
              <span aria-hidden>&rarr;</span>
            </Link>
            <a
              href="#why"
              className="btn-interactive inline-flex h-11 items-center justify-center rounded-lg border border-hairline bg-canvas px-5 text-xs font-semibold text-ink shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all hover:border-hairline hover:bg-surface-soft active:scale-[0.98]"
            >
              See how it works
            </a>
          </div>
        </div>

        <div className="relative">
          <div
            aria-hidden
            className="absolute -right-3 -top-3 hidden h-full w-full rounded-2xl border border-hairline/80 bg-surface-card/60 sm:block shadow-sm"
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
    <div className="relative overflow-hidden rounded-2xl border border-hairline/90 bg-canvas shadow-[0_24px_50px_-12px_rgba(15,23,42,0.12)] ring-1 ring-hairline-soft/80">
      <div className="flex min-h-14 items-center justify-between gap-3 border-b border-hairline bg-surface-dark px-5 text-on-dark">
        <div>
          <p className="text-xs font-semibold tracking-tight">Weekly Work Plan</p>
          <p className="mt-0.5 text-[10px] text-on-dark-soft">Week of Jul 13 - Harborview Residences</p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded-pill border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-hairline border-b border-hairline bg-surface-soft/60">
        <div className="px-4 py-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted">Health</p>
          <div className="mt-2 flex items-end justify-between gap-2">
            <span className="text-2xl font-semibold tracking-tight text-ink tabular-nums">82</span>
            <span className="flex h-6 items-end gap-1" aria-hidden>
              {HEALTH_TREND.map((value, index) => (
                <span
                  key={index}
                  className={`w-1.5 rounded-full transition-all ${
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
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">75%</p>
          <div className="mt-2.5 h-1.5 w-full rounded-full bg-surface-strong" aria-hidden>
            <div className="h-1.5 rounded-full bg-brand-accent" style={{ width: "75%" }} />
          </div>
        </div>
        <div className="px-4 py-4">
          <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted">Open risk</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-ink tabular-nums">1</p>
          <p className="mt-2.5 text-[10px] font-semibold text-error">-2d variance</p>
        </div>
      </div>

      <ul className="divide-y divide-hairline-soft">
        {COMMITMENTS.map((row) => (
          <li key={row.task} className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-surface-soft/50">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-soft border border-hairline text-[10px] font-bold text-body">
              {row.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-tight text-ink">{row.task}</p>
              <p className="mt-0.5 text-xs text-muted">{row.owner}</p>
            </div>
            <span className="mt-1 flex shrink-0 items-center gap-1.5 rounded-pill border border-hairline bg-surface-soft px-2 py-0.5 text-[11px] font-medium text-body">
              <span className={`h-1.5 w-1.5 rounded-full ${TONE_CLASS[row.tone]}`} />
              {row.status}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-hairline bg-surface-soft/60 px-5 py-3 text-xs font-medium text-muted">
        <span>2 Agent proposals open for review</span>
        <span aria-hidden className="font-semibold text-brand-accent">
          &rarr;
        </span>
      </div>
    </div>
  );
}
