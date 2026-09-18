import Link from "next/link";
import { MarketingFooter } from "@/components/MarketingFooter";
import { LandingMegaNav } from "@/components/LandingMegaNav";
import { AgiraMark } from "@/components/landing/AgiraMark";
import {
  featurePages,
  solutionPages,
  type MarketingPageData,
  type MarketingVisual,
} from "@/lib/marketing-content";

export function MarketingDetailPage({ data, isSignedIn }: { data: MarketingPageData; isSignedIn: boolean }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <LandingMegaNav isSignedIn={isSignedIn} onDarkHero />
      <main>
        <Hero data={data} isSignedIn={isSignedIn} />
        <Highlights data={data} />
        <Workflow data={data} />
        <Proof data={data} />
        <RelatedPages data={data} />
        <ClosingCta data={data} isSignedIn={isSignedIn} />
      </main>
      <MarketingFooter />
    </div>
  );
}

function Hero({ data, isSignedIn }: { data: MarketingPageData; isSignedIn: boolean }) {
  return (
    <section className="overflow-hidden bg-surface-dark text-on-dark">
      <div className="mx-auto max-w-[1400px] px-6 pb-0 pt-44 sm:px-10 lg:px-12 lg:pt-52">
        <div className="grid items-center gap-14 lg:grid-cols-[0.88fr_1.12fr] lg:gap-20">
          <div className="pb-16 lg:pb-24">
            <div className="mb-7 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.12em] text-on-dark-soft">
              <Link href={data.section === "Features" ? "/#features" : "/#roles"} className="transition-colors hover:text-on-dark">
                {data.section}
              </Link>
              <span className="h-px w-5 bg-brand-accent" />
              <span>{data.group}</span>
            </div>
            <p className="mb-5 text-sm font-semibold text-brand-accent">{data.title}</p>
            <h1 className="max-w-[11ch] text-5xl font-semibold leading-[0.98] tracking-[0] text-on-dark sm:text-6xl lg:text-7xl">
              {data.headline}
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-on-dark-soft sm:text-lg sm:leading-8">{data.description}</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href={isSignedIn ? "/projects" : "/sign-up"}
                className="inline-flex h-12 items-center justify-center rounded-md bg-on-dark px-6 text-sm font-bold text-ink transition-colors hover:bg-on-dark/90"
              >
                {isSignedIn ? "Open Agira" : "Start building"}
                <ArrowIcon />
              </Link>
              <Link
                href="/#features"
                className="inline-flex h-12 items-center justify-center rounded-md border border-on-dark/20 px-6 text-sm font-semibold text-on-dark transition-colors hover:bg-on-dark/10"
              >
                Explore the platform
              </Link>
            </div>
          </div>

          <div className="relative self-end">
            <div className="absolute -left-4 top-10 hidden h-[76%] w-px bg-on-dark/12 lg:block" aria-hidden />
            <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.1em] text-on-dark-soft">
              <span>{data.visualLabel}</span>
              <span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-success" /> Live workspace</span>
            </div>
            <ProductVisual kind={data.visual} title={data.title} />
          </div>
        </div>

        <div className="grid border-t border-on-dark/14 sm:grid-cols-3">
          {data.outcomes.map((outcome, index) => (
            <div key={outcome} className={`flex min-h-20 items-center gap-4 py-5 sm:px-6 ${index > 0 ? "border-t border-on-dark/14 sm:border-l sm:border-t-0" : ""}`}>
              <span className="text-xs font-bold text-brand-accent">0{index + 1}</span>
              <span className="text-sm font-medium text-on-dark-soft">{outcome}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Highlights({ data }: { data: MarketingPageData }) {
  return (
    <section className="border-b border-hairline bg-canvas">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">Designed for production</p>
            <h2 className="mt-5 max-w-[12ch] text-4xl font-semibold leading-[1.05] tracking-[0] sm:text-5xl">
              Less administration. More control.
            </h2>
          </div>
          <div className="border-t border-hairline">
            {data.highlights.map((highlight, index) => (
              <article key={highlight.title} className="grid gap-4 border-b border-hairline py-8 sm:grid-cols-[52px_0.75fr_1.25fr] sm:items-start sm:gap-7">
                <span className="font-mono text-xs text-muted-soft">0{index + 1}</span>
                <h3 className="text-lg font-semibold text-ink">{highlight.title}</h3>
                <p className="text-sm leading-6 text-body">{highlight.body}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Workflow({ data }: { data: MarketingPageData }) {
  return (
    <section className="bg-surface-dark text-on-dark">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="flex flex-col gap-6 border-b border-on-dark/14 pb-12 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">How it works</p>
            <h2 className="mt-5 max-w-[14ch] text-4xl font-semibold leading-[1.05] tracking-[0] text-on-dark sm:text-5xl">
              A workflow your team can repeat.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-on-dark-soft">
            Built around the operating rhythm of a construction project, with every step connected to the same live plan.
          </p>
        </div>

        <div className="grid lg:grid-cols-4">
          {data.workflow.map((step, index) => (
            <article key={step.title} className={`relative py-10 lg:min-h-72 lg:px-7 ${index > 0 ? "border-t border-on-dark/14 lg:border-l lg:border-t-0" : ""}`}>
              <div className="mb-12 flex items-center justify-between">
                <span className="font-mono text-xs text-on-dark-soft">0{index + 1}</span>
                <span className={`h-2 w-2 rounded-full ${index === 3 ? "bg-success" : "bg-brand-accent"}`} />
              </div>
              <h3 className="text-lg font-semibold text-on-dark">{step.title}</h3>
              <p className="mt-3 text-sm leading-6 text-on-dark-soft">{step.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Proof({ data }: { data: MarketingPageData }) {
  return (
    <section className="border-b border-hairline bg-surface-soft">
      <div className="mx-auto grid max-w-[1400px] gap-12 px-6 py-24 sm:px-10 lg:grid-cols-[0.65fr_1.35fr] lg:px-12 lg:py-28">
        <div className="border-l-2 border-brand-accent pl-6">
          <p className="text-5xl font-semibold tracking-[0] text-ink sm:text-6xl">{data.proof.value}</p>
          <p className="mt-3 text-sm font-medium text-muted">{data.proof.label}</p>
        </div>
        <div>
          <h2 className="max-w-[21ch] text-3xl font-semibold leading-tight tracking-[0] text-ink sm:text-4xl">{data.proof.title}</h2>
          <p className="mt-6 max-w-2xl text-base leading-7 text-body">{data.proof.body}</p>
        </div>
      </div>
    </section>
  );
}

function RelatedPages({ data }: { data: MarketingPageData }) {
  const pages = Object.values(data.section === "Features" ? featurePages : solutionPages);
  const currentIndex = pages.findIndex((page) => page.slug === data.slug);
  const related = [pages[(currentIndex + 1) % pages.length], pages[(currentIndex + 2) % pages.length]];
  const base = data.section.toLowerCase();

  return (
    <section className="bg-canvas">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-28">
        <div className="mb-10 flex items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">Keep exploring</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-[0] text-ink">Connected by design.</h2>
          </div>
          <Link href="/#features" className="hidden text-sm font-semibold text-ink hover:underline sm:block">View platform overview</Link>
        </div>
        <div className="grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline md:grid-cols-2">
          {related.map((page, index) => (
            <Link key={page.slug} href={`/${base}/${page.slug}`} className="group bg-canvas p-7 transition-colors hover:bg-surface-soft sm:p-9">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-soft">{page.group}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-md border border-hairline text-ink transition-colors group-hover:border-ink group-hover:bg-ink group-hover:text-on-primary">
                  <ArrowIcon compact />
                </span>
              </div>
              <h3 className="mt-12 text-2xl font-semibold tracking-[0] text-ink">{page.title}</h3>
              <p className="mt-3 max-w-md text-sm leading-6 text-body">{page.description}</p>
              <span className="mt-8 block font-mono text-[10px] text-muted-soft">0{index + 1}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function ClosingCta({ data, isSignedIn }: { data: MarketingPageData; isSignedIn: boolean }) {
  return (
    <section className="bg-primary text-on-primary">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-10 px-6 py-20 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:py-24">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-on-primary/68">Put {data.title} to work</p>
          <h2 className="mt-5 max-w-[17ch] text-4xl font-semibold leading-[1.05] tracking-[0] text-on-primary sm:text-5xl">
            Connect the schedule to the people building it.
          </h2>
        </div>
        <Link
          href={isSignedIn ? "/projects" : "/sign-up"}
          className="inline-flex h-13 shrink-0 items-center justify-center self-start rounded-md bg-canvas px-7 text-sm font-bold text-ink transition-colors hover:bg-surface-soft lg:self-auto"
        >
          {isSignedIn ? "Open your projects" : "Get started free"}
          <ArrowIcon />
        </Link>
      </div>
    </section>
  );
}

function ProductVisual({ kind, title }: { kind: MarketingVisual; title: string }) {
  return (
    <div className="overflow-hidden rounded-t-lg border border-b-0 border-on-dark/18 bg-surface-soft text-ink shadow-[0_30px_80px_rgba(0,0,0,0.28)]">
      <div className="flex h-12 items-center gap-2 border-b border-hairline bg-canvas px-4">
        <span className="h-2.5 w-2.5 rounded-full bg-error" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning" />
        <span className="h-2.5 w-2.5 rounded-full bg-success" />
        <span className="ml-3 truncate text-xs font-semibold text-ink">{title}</span>
        <span className="ml-auto rounded bg-surface-card px-2 py-1 text-[9px] font-bold uppercase text-muted">Live</span>
      </div>
      <div className="min-h-[410px] p-4 sm:min-h-[470px] sm:p-6">
        {kind === "schedule" && <ScheduleVisual />}
        {kind === "impact" && <ImpactVisual />}
        {kind === "documents" && <DocumentsVisual />}
        {kind === "lookahead" && <LookaheadVisual />}
        {kind === "field" && <FieldVisual />}
        {kind === "weekly" && <WeeklyVisual />}
        {kind === "risk" && <RiskVisual />}
        {kind === "portfolio" && <PortfolioVisual />}
        {kind === "analytics" && <AnalyticsVisual />}
        {kind === "ai" && <AiVisual />}
        {kind === "role" && <RoleVisual />}
        {kind === "integration" && <IntegrationVisual title={title} />}
      </div>
    </div>
  );
}

function VisualHeading({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-ink">{label}</p>
        <p className="mt-1 text-[10px] text-muted-soft">North Tower Expansion</p>
      </div>
      <span className="rounded-md border border-hairline bg-canvas px-2.5 py-1.5 text-[9px] font-semibold text-muted">{meta}</span>
    </div>
  );
}

const scheduleRows = [
  ["Structure complete", "100%", "left-[6%] w-[28%] bg-primary"],
  ["Level 4 framing", "72%", "left-[29%] w-[33%] bg-brand-accent"],
  ["MEP rough-in", "44%", "left-[47%] w-[29%] bg-success"],
  ["Interior close-in", "12%", "left-[68%] w-[24%] bg-surface-strong"],
] as const;

function ScheduleVisual() {
  return (
    <>
      <VisualHeading label="Master schedule" meta="Updated today" />
      <div className="grid grid-cols-[132px_1fr] overflow-hidden rounded-md border border-hairline bg-canvas sm:grid-cols-[170px_1fr]">
        <div className="border-r border-hairline">
          <div className="h-9 border-b border-hairline px-3 py-2 text-[9px] font-bold uppercase text-muted-soft">Activity</div>
          {scheduleRows.map(([name, progress]) => (
            <div key={name} className="h-16 border-b border-hairline-soft px-3 py-3 last:border-b-0">
              <p className="truncate text-[10px] font-semibold">{name}</p>
              <p className="mt-1 text-[9px] text-muted">{progress} complete</p>
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <div className="grid h-9 grid-cols-4 border-b border-hairline text-center text-[8px] font-semibold text-muted">
            <span className="py-2.5">W18</span>
            <span className="py-2.5">W19</span>
            <span className="py-2.5">W20</span>
            <span className="py-2.5">W21</span>
          </div>
          {scheduleRows.map(([name, , bar]) => (
            <div key={name} className="relative h-16 border-b border-hairline-soft last:border-b-0">
              <span className={`absolute top-6 h-3 rounded-sm ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ImpactVisual() {
  const rows = [
    ["SIR-014", "Unforeseen duct conflict", "Review", "2d", "bg-error"],
    ["SIR-012", "South access restriction", "Open", "5d", "bg-warning"],
    ["SIR-009", "Owner finish revision", "Approved", "0d", "bg-success"],
  ] as const;
  return (
    <>
      <VisualHeading label="Impact review" meta="3 active" />
      <div className="grid gap-3">
        {rows.map(([id, title, status, days, tone]) => (
          <div key={id} className="rounded-md border border-hairline bg-canvas p-4">
            <div className="flex items-center gap-3">
              <span className={`h-8 w-1 rounded-full ${tone}`} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-muted">{id}</span>
                  <span className="rounded bg-surface-soft px-1.5 py-0.5 text-[8px] font-semibold">{status}</span>
                </div>
                <p className="mt-1 truncate text-[11px] font-semibold">{title}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold">{days}</p>
                <p className="text-[8px] text-muted">exposure</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-md border border-dashed border-hairline p-3 text-center text-[9px] text-muted">
        Decision history and schedule evidence stay attached
      </div>
    </>
  );
}

function DocumentsVisual() {
  const rows = [
    ["08 44 13", "Curtain wall samples", "Due in 2d", "At risk"],
    ["23 05 93", "HVAC balancing plan", "Due in 8d", "In review"],
    ["26 05 00", "Lighting controls", "Due in 14d", "Submitted"],
    ["09 29 00", "Level 4 finish system", "Approved", "Closed"],
  ] as const;
  return (
    <>
      <VisualHeading label="Document control" meta="Linked to schedule" />
      <div className="overflow-hidden rounded-md border border-hairline bg-canvas">
        <div className="grid grid-cols-[74px_1fr_70px] border-b border-hairline bg-surface-soft px-3 py-2 text-[8px] font-bold uppercase text-muted">
          <span>Spec</span>
          <span>Item</span>
          <span>Status</span>
        </div>
        {rows.map(([spec, item, date, status], index) => (
          <div key={item} className="grid grid-cols-[74px_1fr_70px] items-center border-b border-hairline-soft px-3 py-3 last:border-b-0">
            <span className="font-mono text-[8px] text-muted">{spec}</span>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-semibold">{item}</p>
              <p className={`mt-1 text-[8px] ${index === 0 ? "text-error" : "text-muted"}`}>{date}</p>
            </div>
            <span className="text-[8px] font-semibold text-body">{status}</span>
          </div>
        ))}
      </div>
    </>
  );
}

function LookaheadVisual() {
  const columns = [
    ["This week", ["Deck embeds", "L4 framing"], "bg-primary"],
    ["Week +2", ["MEP overhead", "Exterior framing"], "bg-brand-accent"],
    ["Week +3", ["Drywall layout", "Roof equipment"], "bg-success"],
  ] as const;
  return (
    <>
      <VisualHeading label="Six-week lookahead" meta="17 activities" />
      <div className="grid grid-cols-3 gap-2">
        {columns.map(([week, tasks, tone]) => (
          <div key={week} className="min-w-0 rounded-md border border-hairline bg-surface-soft p-2">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[9px] font-bold">{week}</span>
              <span className="text-[8px] text-muted">{tasks.length}</span>
            </div>
            {tasks.map((task, index) => (
              <div key={task} className="mb-2 rounded bg-canvas p-2.5 shadow-sm">
                <span className={`mb-2 block h-1 w-7 rounded ${tone}`} />
                <p className="text-[9px] font-semibold leading-3">{task}</p>
                <p className="mt-2 text-[7px] text-muted">{index === 0 ? "Ready" : "1 constraint"}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-md border border-hairline bg-canvas p-3">
        <span className="h-2 w-2 rounded-full bg-success" />
        <p className="text-[9px]"><strong>14 of 17</strong> activities are ready to commit</p>
      </div>
    </>
  );
}

function FieldVisual() {
  const tasks = ["Layout level 4 walls", "Set overhead hangers", "Inspect south riser"];
  const bars = [35, 52, 48, 70, 82, 76, 91];
  return (
    <>
      <VisualHeading label="Today's field plan" meta="Mobile synced" />
      <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-lg border-4 border-primary bg-canvas p-3 shadow-lg">
          <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-surface-strong" />
          <p className="text-[9px] font-bold">Tuesday, May 12</p>
          <p className="mt-1 text-[8px] text-muted">4 assigned activities</p>
          {tasks.map((task, index) => (
            <div key={task} className="mt-3 rounded-md border border-hairline p-2">
              <div className="flex gap-2">
                <span className={`mt-0.5 h-3 w-3 rounded-full border ${index === 0 ? "border-success bg-success" : "border-hairline"}`} />
                <div>
                  <p className="text-[8px] font-semibold leading-3">{task}</p>
                  <p className="mt-1 text-[7px] text-muted">Level 4</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <div className="rounded-md border border-hairline bg-canvas p-4">
            <p className="text-[9px] font-bold">Progress received</p>
            <div className="mt-4 flex items-end gap-1">
              {bars.map((height, index) => (
                <span key={index} className={`flex-1 rounded-t-sm ${index === 6 ? "bg-brand-accent" : "bg-surface-strong"}`} style={{ height }} />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[7px] text-muted-soft">
              <span>Wed</span>
              <span>Today</span>
            </div>
          </div>
          <div className="rounded-md border border-hairline bg-canvas p-4">
            <p className="text-[9px] font-bold">Latest site note</p>
            <p className="mt-2 text-[8px] leading-4 text-muted">
              South riser complete. Photo and quantity attached to MEP rough-in.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

function WeeklyVisual() {
  const trades = [
    ["Concrete", [1, 1, 1, 0, 0]],
    ["Electrical", [1, 1, 0, 0, 0]],
    ["Mechanical", [1, 1, 1, 1, 0]],
    ["Framing", [1, 1, 1, 1, 1]],
  ] as const;
  return (
    <>
      <VisualHeading label="Weekly commitments" meta="PPC 84%" />
      <div className="overflow-hidden rounded-md border border-hairline bg-canvas">
        <div className="grid grid-cols-[92px_repeat(5,1fr)] border-b border-hairline bg-surface-soft text-center text-[8px] font-bold text-muted">
          <span className="p-2 text-left">Trade</span>
          {["M", "T", "W", "T", "F"].map((day, index) => (
            <span key={`${day}-${index}`} className="border-l border-hairline-soft p-2">{day}</span>
          ))}
        </div>
        {trades.map(([trade, days], tradeIndex) => (
          <div key={trade} className="grid grid-cols-[92px_repeat(5,1fr)] border-b border-hairline-soft last:border-b-0">
            <span className="truncate p-3 text-[9px] font-semibold">{trade}</span>
            {days.map((done, index) => (
              <span key={index} className="flex items-center justify-center border-l border-hairline-soft p-2">
                <span className={`h-4 w-4 rounded-full ${done ? (tradeIndex === 3 && index === 4 ? "bg-warning" : "bg-success") : "border border-hairline"}`}>
                  {done ? (
                    <span className="flex h-full items-center justify-center text-[8px] text-on-dark">
                      {tradeIndex === 3 && index === 4 ? "!" : "+"}
                    </span>
                  ) : null}
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[["21", "Promises"], ["18", "Complete"], ["3", "Variance"]].map(([value, label]) => (
          <div key={label} className="rounded-md border border-hairline bg-canvas p-3">
            <p className="text-lg font-semibold">{value}</p>
            <p className="text-[8px] text-muted">{label}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function RiskVisual() {
  const items = [
    ["Steel embeds at east core", "Design", "May 14", "High"],
    ["Level 5 material hoist", "Access", "May 17", "Med"],
    ["Lighting control samples", "Submittal", "May 21", "Low"],
  ] as const;
  return (
    <>
      <VisualHeading label="Constraint register" meta="6 need action" />
      <div className="rounded-md border border-hairline bg-canvas p-3">
        <div className="mb-3 grid grid-cols-[8px_1fr_64px] gap-3 px-2 text-[8px] font-bold uppercase text-muted-soft">
          <span />
          <span>Roadblock</span>
          <span>Need by</span>
        </div>
        {items.map(([title, type, date, risk]) => (
          <div key={title} className="grid grid-cols-[8px_1fr_64px] items-center gap-3 border-t border-hairline-soft px-2 py-4">
            <span className={`h-8 w-1 rounded-full ${risk === "High" ? "bg-error" : risk === "Med" ? "bg-warning" : "bg-success"}`} />
            <div className="min-w-0">
              <p className="truncate text-[9px] font-semibold">{title}</p>
              <p className="mt-1 text-[8px] text-muted">{type} - Assigned</p>
            </div>
            <span className="text-[8px] font-semibold">{date}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-between rounded-md bg-surface-dark p-4 text-on-dark">
        <div>
          <p className="text-[9px] font-semibold">Make-ready score</p>
          <p className="mt-1 text-[8px] text-on-dark-soft">Next 3 weeks</p>
        </div>
        <p className="text-2xl font-semibold">82%</p>
      </div>
    </>
  );
}

function PortfolioVisual() {
  const projects = [
    ["North Tower", "On track", "86", "bg-success"],
    ["Riverfront Labs", "Attention", "64", "bg-warning"],
    ["Civic Center", "At risk", "41", "bg-error"],
  ] as const;
  return (
    <>
      <VisualHeading label="Portfolio pulse" meta="12 projects" />
      <div className="grid grid-cols-3 gap-2">
        {[["94%", "Milestones"], ["81%", "Plan reliability"], ["23", "Open risks"]].map(([value, label]) => (
          <div key={label} className="rounded-md border border-hairline bg-canvas p-3">
            <p className="text-lg font-semibold">{value}</p>
            <p className="mt-1 truncate text-[7px] text-muted">{label}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 overflow-hidden rounded-md border border-hairline bg-canvas">
        {projects.map(([name, status, health, color]) => (
          <div key={name} className="grid grid-cols-[1fr_70px] items-center border-b border-hairline-soft p-4 last:border-b-0">
            <div>
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${color}`} />
                <p className="text-[10px] font-semibold">{name}</p>
              </div>
              <p className="ml-4 mt-1 text-[8px] text-muted">{status}</p>
            </div>
            <div>
              <div className="flex justify-between text-[8px]">
                <span>Health</span>
                <strong>{health}</strong>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded bg-surface-strong">
                <span className={`block h-full ${color}`} style={{ width: `${health}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function AnalyticsVisual() {
  const reliability = [38, 48, 43, 57, 62, 58, 72, 69, 77, 83, 79, 88];
  const variance = [
    ["Prerequisite work", "38%", "w-[38%]"],
    ["Design information", "27%", "w-[27%]"],
    ["Material", "19%", "w-[19%]"],
    ["Labor", "16%", "w-[16%]"],
  ] as const;
  return (
    <>
      <VisualHeading label="Planning analytics" meta="Last 12 weeks" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-hairline bg-canvas p-4">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[8px] text-muted">Plan reliability</p>
              <p className="mt-1 text-2xl font-semibold">84%</p>
            </div>
            <span className="text-[8px] font-semibold text-success">+12%</span>
          </div>
          <div className="mt-6 flex h-28 items-end gap-1.5">
            {reliability.map((height, index) => (
              <span key={index} className={`flex-1 rounded-t-sm ${index > 8 ? "bg-brand-accent" : "bg-surface-strong"}`} style={{ height: `${height}%` }} />
            ))}
          </div>
        </div>
        <div className="rounded-md border border-hairline bg-canvas p-4">
          <p className="text-[8px] text-muted">Reasons for variance</p>
          {variance.map(([label, value, width]) => (
            <div key={label} className="mt-4">
              <div className="flex justify-between text-[8px]">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
              <div className="mt-1.5 h-1.5 rounded bg-surface-soft">
                <span className={`block h-full rounded bg-brand-accent ${width}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function AiVisual() {
  const records = [
    ["Activity 129", "MEP rough-in", "2d late"],
    ["RFI-086", "Duct routing conflict", "Open"],
    ["Milestone", "Dry-in complete", "Jun 30"],
  ] as const;
  return (
    <>
      <VisualHeading label="Agent" meta="Project grounded" />
      <div className="rounded-md border border-hairline bg-canvas p-4">
        <div className="ml-auto max-w-[85%] rounded-md bg-surface-dark p-3 text-[9px] leading-4 text-on-dark">
          Which activities put the June 30 milestone at risk?
        </div>
        <div className="mt-4 flex gap-3">
          <AgiraMark size={28} />
          <div>
            <p className="text-[9px] leading-4 text-body">
              Three activities currently affect the milestone. The highest exposure is <strong>Level 4 MEP rough-in</strong>,
              blocked by RFI-086 and two days behind its lookahead commitment.
            </p>
            <div className="mt-3 grid gap-2">
              {records.map(([type, label, status]) => (
                <div key={type} className="flex items-center rounded border border-hairline p-2">
                  <span className="font-mono text-[7px] text-muted">{type}</span>
                  <span className="ml-3 flex-1 text-[8px] font-semibold">{label}</span>
                  <span className="text-[7px] text-error">{status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex items-center rounded-md border border-hairline bg-canvas px-3 py-2">
        <span className="text-[8px] text-muted-soft">Ask about this project...</span>
        <span className="ml-auto flex h-6 w-6 items-center justify-center rounded bg-primary text-[10px] text-on-primary">+</span>
      </div>
    </>
  );
}

function RoleVisual() {
  const items = [
    ["Review milestone movement", "Schedule", "9:00"],
    ["Clear L4 constraints", "Make ready", "10:30"],
    ["Confirm trade commitments", "Weekly plan", "1:00"],
    ["Owner progress review", "Reporting", "3:30"],
  ] as const;
  return (
    <>
      <VisualHeading label="Today's control plan" meta="Tuesday" />
      <div className="grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
        <div className="overflow-hidden rounded-md border border-hairline bg-canvas">
          {items.map(([task, type, time], index) => (
            <div key={task} className="flex items-center gap-3 border-b border-hairline-soft p-3 last:border-b-0">
              <span className={`h-8 w-1 rounded ${index < 2 ? "bg-brand-accent" : "bg-surface-strong"}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[9px] font-semibold">{task}</p>
                <p className="mt-1 text-[7px] text-muted">{type}</p>
              </div>
              <span className="font-mono text-[8px] text-muted">{time}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {[["4", "Actions due"], ["2", "Risks escalated"], ["86%", "Weekly PPC"]].map(([value, label], index) => (
            <div key={label} className={`rounded-md p-3 ${index === 0 ? "bg-surface-dark text-on-dark" : "border border-hairline bg-canvas"}`}>
              <p className="text-xl font-semibold">{value}</p>
              <p className={`mt-1 text-[8px] ${index === 0 ? "text-on-dark-soft" : "text-muted"}`}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function IntegrationVisual({ title }: { title: string }) {
  return (
    <>
      <VisualHeading label="Connected project systems" meta="Sync active" />
      <div className="flex min-h-52 items-center justify-center gap-3 rounded-md border border-hairline bg-canvas p-4 sm:gap-6">
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border border-hairline bg-surface-soft">
          <AgiraMark size={36} />
          <span className="mt-2 text-[8px] font-semibold">Agira</span>
        </div>
        <div className="flex flex-1 items-center">
          <span className="h-px flex-1 bg-hairline" />
          <span className="mx-2 flex h-8 w-8 items-center justify-center rounded-full bg-success text-[10px] text-on-dark">+</span>
          <span className="h-px flex-1 bg-hairline" />
        </div>
        <div className="flex h-24 w-24 flex-col items-center justify-center rounded-lg border border-hairline bg-surface-soft">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-accent text-sm font-bold text-on-dark">
            {title.charAt(0)}
          </span>
          <span className="mt-2 text-center text-[8px] font-semibold">{title}</span>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[["24", "Records linked"], ["6", "Need attention"], ["Now", "Last sync"]].map(([value, label]) => (
          <div key={label} className="rounded-md border border-hairline bg-canvas p-3">
            <p className="text-lg font-semibold">{value}</p>
            <p className="mt-1 text-[7px] text-muted">{label}</p>
          </div>
        ))}
      </div>
    </>
  );
}

function ArrowIcon({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={compact ? "" : "ml-2"} width={compact ? 15 : 16} height={compact ? 15 : 16} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
