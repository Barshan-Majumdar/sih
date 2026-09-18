import type { Metadata } from "next";
import Link from "next/link";
import { LandingMegaNav } from "@/components/LandingMegaNav";
import { MarketingFooter } from "@/components/MarketingFooter";
import { getCurrentSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "Pricing | Agira",
  description: "Simple construction planning software pricing with unlimited project collaborators.",
};

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    eyebrow: "Start planning",
    description: "For a team proving the workflow on a live project.",
    features: ["2 active projects", "Unlimited collaborators", "Master schedule and lookahead", "Weekly planning and PPC", "Core project controls"],
    cta: "Get started",
    ctaHref: "/sign-up",
    featured: false,
  },
  {
    name: "Core",
    price: "$49",
    period: "per organization / month",
    eyebrow: "Run the company",
    description: "For growing contractors connecting every active project.",
    features: ["Unlimited active projects", "Everything in Free", "Portfolio timeline and dashboards", "Agent", "Email notifications"],
    cta: "Contact us",
    ctaHref: "mailto:sales@agira.dev",
    featured: true,
  },
  {
    name: "Pro",
    price: "$99",
    period: "per organization / month",
    eyebrow: "Standardize delivery",
    description: "For organizations building a repeatable planning standard.",
    features: ["Everything in Core", "Python Retrieval and OCR engines", "Advanced portfolio analytics", "Priority support", "Early feature access"],
    cta: "Contact us",
    ctaHref: "mailto:sales@agira.dev",
    featured: false,
  },
] as const;

const COMPARISON = [
  ["Active projects", "2", "Unlimited", "Unlimited"],
  ["Project collaborators", "Unlimited", "Unlimited", "Unlimited"],
  ["Master schedule and Gantt", "Included", "Included", "Included"],
  ["Lookahead and weekly planning", "Included", "Included", "Included"],
  ["Portfolio management", "-", "Included", "Included"],
  ["Agent", "-", "Included", "Included"],
  ["Python Retrieval & OCR", "-", "-", "Included"],
  ["Priority support", "-", "-", "Included"],
] as const;

const FAQS = [
  ["Do trade partners need paid seats?", "No. Every plan includes unlimited project collaborators, so trade partners and field participants can contribute without increasing your bill."],
  ["Is pricing really per organization?", "Yes. Core and Pro are priced once per Agira organization, not per user or per project."],
  ["Can we begin with one live project?", "Yes. The Free plan is designed for exactly that. Start with real work, prove the operating rhythm, and upgrade when you need a larger portfolio."],
  ["Can we change plans later?", "Yes. You can move between plans as your project count and platform needs change."],
] as const;

export default async function PricingPage() {
  const session = await getCurrentSession();
  const isSignedIn = !!session?.user;
  const closingHref = isSignedIn ? "/plan" : "/sign-up";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <LandingMegaNav isSignedIn={isSignedIn} onDarkHero />
      <main>
        <section className="bg-surface-dark text-on-dark">
          <div className="mx-auto max-w-[1400px] px-6 pb-20 pt-44 sm:px-10 lg:px-12 lg:pb-28 lg:pt-52">
            <div className="grid items-end gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">Pricing</p>
                <h1 className="mt-6 max-w-[11ch] text-5xl font-semibold leading-[0.98] tracking-[0] text-on-dark sm:text-6xl lg:text-7xl">
                  One price for the whole project team.
                </h1>
              </div>
              <div className="border-l border-on-dark/18 pl-6 lg:pb-2">
                <p className="max-w-lg text-base leading-7 text-on-dark-soft sm:text-lg sm:leading-8">
                  Invite the office, field, and trade partners without counting seats. Choose a plan based on how your organization works, not how many people participate.
                </p>
              </div>
            </div>
            <div className="mt-16 grid border-y border-on-dark/14 sm:grid-cols-3">
              {["Unlimited collaborators", "No per-project surcharge", "Start with real work"].map((item, index) => (
                <div key={item} className={`flex min-h-20 items-center gap-4 py-5 sm:px-6 ${index > 0 ? "border-t border-on-dark/14 sm:border-l sm:border-t-0" : ""}`}>
                  <span className="font-mono text-xs text-brand-accent">0{index + 1}</span>
                  <span className="text-sm font-medium text-on-dark-soft">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-hairline bg-surface-soft">
          <div className="mx-auto max-w-[1400px] px-6 py-20 sm:px-10 lg:px-12 lg:py-28">
            <div className="mb-12 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">Choose your operating level</p>
                <h2 className="mt-5 text-4xl font-semibold tracking-[0] sm:text-5xl">Simple by design.</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-body">All plans include the connected planning foundation. Upgrade for portfolio scale, intelligence, and integrations.</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {TIERS.map((tier) => (
                <article key={tier.name} className={`relative flex min-h-[570px] flex-col rounded-lg border p-7 sm:p-8 ${tier.featured ? "border-surface-dark bg-surface-dark text-on-dark shadow-[0_22px_55px_rgba(16,23,32,0.16)]" : "border-hairline bg-canvas text-ink"}`}>
                  {tier.featured && <span className="absolute right-5 top-5 rounded-md bg-brand-accent px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-on-dark">Most popular</span>}
                  <p className={`text-[10px] font-bold uppercase tracking-[0.1em] ${tier.featured ? "text-on-dark/45" : "text-muted-soft"}`}>{tier.eyebrow}</p>
                  <h3 className="mt-6 text-xl font-semibold">{tier.name}</h3>
                  <div className="mt-5 flex items-end gap-2">
                    <span className="text-5xl font-semibold tracking-[0]">{tier.price}</span>
                    <span className={`mb-1 max-w-28 text-xs leading-4 ${tier.featured ? "text-on-dark/45" : "text-muted"}`}>{tier.period}</span>
                  </div>
                  <p className={`mt-5 min-h-12 text-sm leading-6 ${tier.featured ? "text-on-dark/62" : "text-body"}`}>{tier.description}</p>
                  <div className={`my-7 h-px ${tier.featured ? "bg-on-dark/14" : "bg-hairline"}`} />
                  <ul className="space-y-4">
                    {tier.features.map((feature) => (
                      <li key={feature} className={`flex items-start gap-3 text-sm ${tier.featured ? "text-on-dark/72" : "text-body"}`}>
                        <CheckIcon accent={tier.featured} />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href={tier.ctaHref} className={`mt-auto inline-flex h-12 items-center justify-center rounded-md text-sm font-bold transition-colors ${tier.featured ? "bg-on-dark text-ink hover:bg-on-dark/90" : "bg-primary text-on-primary hover:bg-primary-active"}`}>
                    {tier.cta}
                  </Link>
                </article>
              ))}
            </div>
            <p className="mt-7 text-center text-xs text-muted-soft">Core and Pro plans are set up by your organization owner.</p>
          </div>
        </section>

        <section className="border-b border-hairline bg-canvas">
          <div className="mx-auto max-w-[1200px] px-6 py-24 sm:px-10 lg:px-12 lg:py-28">
            <div className="mb-10">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">Plan comparison</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[0]">The details, clearly.</h2>
            </div>
            <div className="overflow-x-auto rounded-lg border border-hairline">
              <table className="w-full min-w-[720px] border-collapse bg-canvas text-left">
                <thead>
                  <tr className="border-b border-hairline bg-surface-soft">
                    <th className="w-[40%] p-5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-soft">Capability</th>
                    {TIERS.map((tier) => <th key={tier.name} className="p-5 text-sm font-semibold text-ink">{tier.name}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map(([feature, free, core, pro]) => (
                    <tr key={feature} className="border-b border-hairline last:border-b-0">
                      <td className="p-5 text-sm font-medium text-ink">{feature}</td>
                      {[free, core, pro].map((value, index) => <td key={`${feature}-${index}`} className={`p-5 text-sm ${value === "-" ? "text-muted-soft" : "text-body"}`}>{value}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="bg-surface-dark text-on-dark">
          <div className="mx-auto grid max-w-[1400px] gap-14 px-6 py-24 sm:px-10 lg:grid-cols-[0.75fr_1.25fr] lg:px-12 lg:py-28">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-brand-accent">Questions</p>
              <h2 className="mt-5 max-w-[10ch] text-4xl font-semibold leading-[1.05] tracking-[0] text-on-dark sm:text-5xl">Straight answers before you start.</h2>
            </div>
            <div className="border-t border-on-dark/14">
              {FAQS.map(([question, answer], index) => (
                <article key={question} className="grid gap-4 border-b border-on-dark/14 py-7 sm:grid-cols-[36px_0.8fr_1.2fr] sm:gap-6">
                  <span className="font-mono text-xs text-on-dark-soft">0{index + 1}</span>
                  <h3 className="text-sm font-semibold text-on-dark">{question}</h3>
                  <p className="text-sm leading-6 text-on-dark-soft">{answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-primary text-on-primary">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-9 px-6 py-20 sm:px-10 lg:flex-row lg:items-center lg:justify-between lg:px-12 lg:py-24">
            <h2 className="max-w-[16ch] text-4xl font-semibold leading-[1.05] tracking-[0] text-on-primary sm:text-5xl">Bring the whole project team into one plan.</h2>
            <Link href={closingHref} className="inline-flex h-12 shrink-0 items-center justify-center self-start rounded-md bg-canvas px-7 text-sm font-bold text-ink transition-colors hover:bg-surface-soft lg:self-auto">
              {isSignedIn ? "View your plan" : "Get started free"}
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}

function CheckIcon({ accent }: { accent: boolean }) {
  return (
    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${accent ? "bg-brand-accent text-on-dark" : "bg-success/15 text-success"}`}>
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden><path d="m2 5 2 2 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
    </span>
  );
}
