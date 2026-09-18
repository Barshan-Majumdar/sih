import Link from "next/link";
import { AgiraHero } from "@/components/landing/AgiraHero";
import { AgiraMark } from "@/components/landing/AgiraMark";
import { LandingMegaNav } from "@/components/LandingMegaNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { LandingProductShowcase } from "@/components/LandingProductShowcase";
import { getCurrentSession } from "@/lib/session";

export default async function LandingPage() {
  const session = await getCurrentSession();
  const isSignedIn = !!session?.user;

  return (
    <div className="bg-canvas text-ink">
      <LandingMegaNav isSignedIn={isSignedIn} />
      <AgiraHero isSignedIn={isSignedIn} />
      <ProofStrip />
      <OperatingLoopBand />
      <CitedReversibleBand />
      <ShowcaseBand />
      <RolesBand />
      <IntegrationsBand />
      <CtaBand isSignedIn={isSignedIn} />
      <MarketingFooter />
    </div>
  );
}

const PROOF_METRICS = [
  ["4", "roles with a purpose-built view: PM, scheduler, superintendent, trade partner"],
  ["100%", "self-hosted & open: zero paid commercial vendor lock-in"],
  ["1", "plan, from the master schedule to the weekly commitment"],
  ["0", "writes without your confirmation"],
] as const;

function ProofStrip() {
  return (
    <section className="border-y border-hairline bg-canvas">
      <div className="mx-auto max-w-[1400px] px-6 py-14 sm:px-10 lg:px-12">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-[1fr_1fr_1fr_1.3fr]">
          {PROOF_METRICS.map(([value, label], index) => {
            const isHighlight = index === PROOF_METRICS.length - 1;
            return (
              <div
                key={label}
                className={`px-6 py-9 sm:px-7 lg:py-11 ${isHighlight ? "bg-canvas" : "bg-surface-soft"}`}
              >
                <p
                  className={`font-semibold tracking-[0] ${
                    isHighlight ? "text-5xl text-brand-accent sm:text-6xl" : "text-4xl text-ink sm:text-5xl"
                  }`}
                >
                  {value}
                </p>
                <p className="mt-3 max-w-[26ch] text-xs leading-5 text-muted">{label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const LOOP_STEPS = [
  {
    number: "01",
    title: "Build the master plan",
    body: "Create activities, connect dependencies, protect milestones, and expose the critical path.",
    signal: "Contract schedule",
    tone: "bg-primary",
  },
  {
    number: "02",
    title: "Make it field-ready",
    body: "Pull upcoming work into a rolling lookahead and sequence it with the people doing the work.",
    signal: "2-6 week lookahead",
    tone: "bg-brand-accent",
  },
  {
    number: "03",
    title: "Run the week",
    body: "Capture trade commitments, completion, and reasons for variance while they are still actionable.",
    signal: "Weekly commitments",
    tone: "bg-success",
  },
  {
    number: "04",
    title: "Learn and adjust",
    body: "Feed actual progress, roadblocks, PPC, and schedule impact back into the next planning cycle.",
    signal: "Performance intelligence",
    tone: "bg-warning",
  },
] as const;

function OperatingLoopBand() {
  return (
    <section id="why" className="scroll-mt-24 bg-surface-dark text-on-dark">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="grid gap-10 border-b border-on-dark/15 pb-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">
              The operating rhythm
            </p>
            <h2 className="max-w-[12ch] text-4xl font-semibold leading-[1.06] tracking-[0] sm:text-5xl">
              The schedule becomes how the project runs.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-on-dark-soft lg:justify-self-end">
            The master schedule does not stop at the update meeting. Agira keeps it live between the office, the
            field, and the next decision.
          </p>
        </div>

        <div className="grid lg:grid-cols-4">
          {LOOP_STEPS.map((step, index) => (
            <article
              key={step.number}
              className={`relative min-h-80 border-on-dark/15 py-10 lg:px-7 ${
                index > 0 ? "border-t lg:border-l lg:border-t-0" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-on-dark-soft">{step.number}</span>
                <span className={`h-2 w-2 rounded-full ${step.tone}`} />
              </div>
              <h3 className="mt-16 max-w-[14ch] text-xl font-semibold tracking-[0]">{step.title}</h3>
              <p className="mt-4 max-w-[30ch] text-sm leading-6 text-on-dark-soft">{step.body}</p>
              <p className="absolute bottom-10 left-0 text-[10px] font-bold uppercase tracking-[0.1em] text-on-dark-soft lg:left-7">
                {step.signal}
              </p>
            </article>
          ))}
        </div>

        <div className="grid border border-on-dark/15 bg-on-dark/[0.04] md:grid-cols-[0.75fr_1.25fr]">
          <div className="border-b border-on-dark/15 p-6 md:border-b-0 md:border-r lg:p-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-on-dark-soft">Live project pulse</p>
            <div className="mt-7 flex items-end gap-4">
              <span className="text-5xl font-semibold">82</span>
              <span className="mb-1 text-xs font-semibold text-success">Healthy</span>
            </div>
            <p className="mt-3 text-xs text-on-dark-soft">Composite health across schedule, PPC, variance, and roadblocks.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {[["68%", "Complete"], ["75%", "PPC"], ["1", "Open risk"], ["-2d", "Variance"]].map(([value, label]) => (
              <div key={label} className="border-b border-r border-on-dark/10 p-5 last:border-r-0 sm:border-b-0 lg:p-7">
                <p className="text-2xl font-semibold">{value}</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-on-dark-soft">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const SAFE_AI_STEPS = [
  { number: "01", title: "Risk detected", body: "A slip, roadblock, or open control item appears on the live plan." },
  { number: "02", title: "Agent reads", body: "Live tasks, commitments, and uploaded project documents are queried in context." },
  { number: "03", title: "Exact-page cite", body: "Sources show the file, page number, and excerpt when documents back the answer." },
  { number: "04", title: "Proposal ready", body: "Changes, warnings, and expected impact are shown, still no write." },
  { number: "05", title: "Human confirms", body: "Explicit approval only. Permissions and stale snapshots are rechecked." },
  { number: "06", title: "Logged result", body: "The schedule, RFI, or commitment updates atomically and lands in the activity log." },
] as const;

function CitedReversibleBand() {
  return (
    <section id="cited" className="scroll-mt-24 border-b border-hairline bg-canvas">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">
              Cited and reversible
            </p>
            <h2 className="max-w-[18ch] text-4xl font-semibold leading-[1.05] tracking-[0] text-ink sm:text-5xl">
              From project risk to a confirmed action.
            </h2>
          </div>
          <p className="max-w-md text-base leading-7 text-body lg:justify-self-end">
            The Agent reads the live schedule, commitments, and uploaded documents. Every proposed change is cited
            where possible, reviewable before it applies, and written only after explicit confirmation.
          </p>
        </div>

        <ol className="mt-14 grid gap-px border border-hairline bg-hairline sm:grid-cols-2 xl:grid-cols-3">
          {SAFE_AI_STEPS.map((step) => (
            <li key={step.number} className="min-h-[180px] bg-canvas px-6 py-7">
              <p className="text-[10px] font-bold text-brand-accent">{step.number}</p>
              <h3 className="mt-4 text-base font-semibold text-ink">{step.title}</h3>
              <p className="mt-3 max-w-[34ch] text-xs leading-5 text-muted">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-t border-hairline pt-6 text-xs font-semibold text-muted">
          <span>Permission recheck</span>
          <span>Stale-data protection</span>
          <span>Atomic apply</span>
          <span>Activity history</span>
        </div>

        <div className="mt-16 grid gap-10 border-t border-hairline pt-16 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">Agent</p>
            <h3 className="max-w-[16ch] text-2xl font-semibold leading-[1.15] tracking-[0] text-ink sm:text-3xl">
              Every proposal shows its source before it shows a button to confirm.
            </h3>
            <p className="mt-4 max-w-sm text-sm leading-6 text-body">
              A proposal card carries the source excerpt, the change, the expected impact, and the confirm step the
              Agent always requires.
            </p>
          </div>
          <ProposalPreview />
        </div>
      </div>
    </section>
  );
}

function ProposalPreview() {
  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-canvas shadow-[0_24px_60px_rgba(16,23,32,0.12)]">
      <div className="flex min-h-14 items-center justify-between bg-surface-dark px-5 text-on-dark">
        <div className="flex items-center gap-3">
          <AgiraMark size={28} />
          <div>
            <p className="text-xs font-semibold">Agira Agent</p>
            <p className="text-[9px] text-on-dark-soft">Harborview Residences - Building A</p>
          </div>
        </div>
        <span className="flex items-center gap-2 text-[9px] text-on-dark-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Live data
        </span>
      </div>
      <div className="space-y-4 bg-surface-soft p-4 sm:p-6">
        <div className="ml-auto max-w-[82%] rounded-lg bg-surface-dark px-4 py-3 text-xs leading-5 text-on-dark">
          Raise an RFI about panel clearance for Electrical panel inspection, citing the architectural plans.
        </div>

        <div className="max-w-[94%] rounded-lg border border-hairline bg-canvas p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-accent">Action proposal</p>
            <span className="rounded-md bg-surface-card px-2 py-0.5 text-[10px] font-semibold text-warning">
              Pending confirmation
            </span>
          </div>
          <p className="mt-3 text-xs font-semibold text-ink">Raise RFI - panel clearance</p>
          <p className="mt-2 text-xs leading-5 text-body">
            Confirm required working clearances at the main electrical panel before re-inspection. Linked to
            Electrical panel inspection.
          </p>

          <div className="mt-4 rounded-md border border-hairline-soft bg-surface-soft px-3 py-2.5">
            <p className="text-[10px] font-semibold text-muted">Source</p>
            <p className="mt-1 text-xs text-ink">A000 NIST NZERTF Architectural Plans.pdf - page 1</p>
            <p className="mt-1 text-[11px] leading-4 text-muted">
              &ldquo;Confirm required working clearances at main distribution panel.&rdquo;
            </p>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 border-y border-hairline py-3 text-xs">
            <div>
              <dt className="text-[10px] text-muted">Change</dt>
              <dd className="mt-1 font-medium text-ink">Create open RFI</dd>
            </div>
            <div>
              <dt className="text-[10px] text-muted">Impact</dt>
              <dd className="mt-1 font-medium text-ink">Unblocks inspection path</dd>
            </div>
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[11px] font-semibold text-on-primary">
              Confirm change
            </span>
            <span className="inline-flex h-8 items-center rounded-md border border-hairline px-3 text-[11px] font-semibold text-muted">
              Cancel
            </span>
          </div>
          <p className="mt-3 text-[10px] leading-4 text-muted">
            No write yet. Confirm rechecks permissions and stale data, then logs the action.
          </p>
        </div>
      </div>
    </div>
  );
}

function ShowcaseBand() {
  return (
    <section id="features" className="scroll-mt-24 bg-canvas">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="grid items-end gap-10 lg:grid-cols-[1.35fr_0.65fr]">
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">
              The connected project system
            </p>
            <h2 className="max-w-[16ch] text-4xl font-semibold leading-[1.05] tracking-[0] text-ink sm:text-5xl lg:text-6xl">
              One plan from baseline to field execution.
            </h2>
          </div>
          <div className="border-l-2 border-brand-accent pl-5">
            <p className="text-base leading-7 text-body">
              Agira links schedule logic, short-interval planning, weekly commitments, project controls, and
              portfolio visibility. Every team works from the same live project truth.
            </p>
          </div>
        </div>

        <div className="mt-14 lg:mt-20">
          <LandingProductShowcase />
        </div>

        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-[1fr_1.2fr_1fr]">
          {[
            ["01", "Schedule logic stays connected", "Dependencies, dates, critical path, and field updates move together."],
            ["02", "Commitments become measurable", "Weekly promises produce PPC and variance signals automatically."],
            ["03", "Risk reaches the right level", "Roadblocks and constraints roll into portfolio health without report chasing."],
          ].map(([number, title, detail], index) => {
            const isHighlight = index === 1;
            return (
              <div
                key={title}
                className={`px-6 py-8 sm:px-7 lg:py-10 ${isHighlight ? "bg-canvas" : "bg-surface-soft"}`}
              >
                <p className="text-[10px] font-bold text-brand-accent">{number}</p>
                <h3 className={`mt-3 font-semibold text-ink ${isHighlight ? "text-base" : "text-sm"}`}>{title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const ROLES = [
  {
    number: "01",
    title: "Project Managers",
    lead: "Control the whole project without building another report.",
    details: ["Schedule health", "Risk ownership", "Project controls"],
    tone: "bg-primary",
  },
  {
    number: "02",
    title: "Schedulers",
    lead: "Protect schedule logic while the project moves in real time.",
    details: ["Critical path", "Dependencies", "Baselines + variance"],
    tone: "bg-brand-accent",
  },
  {
    number: "03",
    title: "Superintendents",
    lead: "Turn the contract plan into executable work for the field.",
    details: ["Lookaheads", "Pull planning", "Constraint removal"],
    tone: "bg-success",
  },
  {
    number: "04",
    title: "Trade Partners",
    lead: "Commit, update, and raise issues without learning scheduling software.",
    details: ["My work", "Weekly promises", "Field updates"],
    tone: "bg-warning",
  },
] as const;

function RolesBand() {
  return (
    <section id="roles" className="scroll-mt-24 bg-canvas">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-32">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">Built around the team</p>
            <h2 className="max-w-[13ch] text-4xl font-semibold leading-[1.06] tracking-[0] sm:text-5xl">
              The right view for every person on the project.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-body lg:justify-self-end">
            Agira keeps one connected data model underneath purpose-built workflows. Everyone sees what they need,
            and the project keeps one version of the truth.
          </p>
        </div>

        <div className="mt-16 grid border-y border-hairline md:grid-cols-2 xl:grid-cols-4">
          {ROLES.map((role, index) => (
            <article
              key={role.title}
              className={`relative min-h-[390px] px-0 py-8 md:px-7 xl:min-h-[430px] ${
                index > 0 ? "border-t border-hairline md:border-l md:border-t-0" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-muted-soft">{role.number}</span>
                <span className={`h-2 w-2 rounded-full ${role.tone}`} />
              </div>
              <h3 className="mt-16 text-xl font-semibold tracking-[0] text-ink">{role.title}</h3>
              <p className="mt-4 max-w-[28ch] text-sm leading-6 text-body">{role.lead}</p>
              <ul className="absolute bottom-8 left-0 space-y-2.5 md:left-7">
                {role.details.map((detail) => (
                  <li key={detail} className="flex items-center gap-2.5 text-xs font-medium text-muted">
                    <span className="h-px w-4 bg-muted-soft" />{detail}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

const INTEGRATIONS = [
  {
    name: "Python Hybrid Retrieval Engine (BM25 + FAISS)",
    body: "Domain-specific microservice executing lexical search, dense vector retrieval, and an 8-signal contextual reranker for real-time progress linking.",
    detail: "Self-Hosted & Active (Port 8000)",
  },
  {
    name: "Document OCR Engine (OCRmyPDF)",
    body: "Self-hosted worker extracting searchable text and engineering observations from scanned PDFs, daily progress notes, and jobsite drawings.",
    detail: "Self-Hosted & Active (Port 8010)",
  },
] as const;

function IntegrationsBand() {
  return (
    <section id="integrations" className="scroll-mt-24 border-y border-hairline bg-surface-soft">
      <div className="mx-auto max-w-[1400px] px-6 py-24 sm:px-10 lg:px-12 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-end">
          <div>
            <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">Integrations</p>
            <h2 className="max-w-[14ch] text-4xl font-semibold leading-[1.06] tracking-[0] sm:text-5xl">
              Keep the systems of record. Add the schedule context.
            </h2>
          </div>
          <p className="max-w-2xl text-base leading-7 text-body lg:justify-self-end">
            Agira connects to the document and project systems teams already use, so drawings and field records stay
            linked to the plan they affect.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-lg border border-hairline bg-hairline sm:grid-cols-2">
          {INTEGRATIONS.map((integration) => (
            <article key={integration.name} className="bg-canvas p-7 sm:p-9">
              <h3 className="text-lg font-semibold text-ink">{integration.name}</h3>
              <p className="mt-3 text-sm leading-6 text-body">{integration.body}</p>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-soft">{integration.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaBand({ isSignedIn }: { isSignedIn: boolean }) {
  return (
    <section className="bg-surface-card">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-6 py-24 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:px-12 lg:py-28">
        <div>
          <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">Start with the next project</p>
          <h2 className="max-w-[16ch] text-4xl font-semibold leading-[1.06] tracking-[0] text-ink sm:text-5xl">
            Put the schedule where the work actually happens.
          </h2>
        </div>
        <div className="lg:justify-self-end">
          <p className="max-w-md text-base leading-7 text-body">
            Create a connected project workspace, bring in the team, and turn the next schedule update into a shared
            operating plan.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={isSignedIn ? "/projects" : "/sign-up"}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-semibold text-on-primary transition-colors hover:bg-primary-active"
            >
              {isSignedIn ? "Open your projects" : "Create your workspace"}<span aria-hidden>→</span>
            </Link>
            <a
              href="#features"
              className="inline-flex h-11 items-center justify-center rounded-md border border-hairline px-5 text-sm font-semibold text-ink transition-colors hover:bg-canvas"
            >
              Explore the product
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
