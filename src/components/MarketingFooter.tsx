import Link from "next/link";
import { AgiraMark } from "@/components/landing/AgiraMark";

const FOOTER_COLUMNS = [
  {
    title: "Platform",
    links: [
      ["Master Schedule", "/features/master-schedule"],
      ["Lookahead Planning", "/features/lookahead"],
      ["Weekly Work Plan", "/features/weekly-work-plan"],
      ["Portfolio Analytics", "/features/analytics"],
    ],
  },
  {
    title: "Solutions",
    links: [
      ["Project Managers", "/solutions/project-managers"],
      ["Schedulers", "/solutions/schedulers"],
      ["Superintendents", "/solutions/superintendents"],
      ["Enterprise", "/solutions/enterprise"],
    ],
  },
  {
    title: "Explore",
    links: [
      ["Agent", "/features/ai-assistant"],
      ["Autodesk", "/solutions/autodesk"],
      ["Procore", "/solutions/procore"],
      ["Pricing", "/pricing"],
    ],
  },
] as const;

export function MarketingFooter() {
  return (
    <footer className="overflow-hidden bg-surface-soft px-4 pt-5 sm:px-7 sm:pt-7 lg:px-10 lg:pt-10">
      <div className="mx-auto max-w-[1800px] rounded-[28px] border border-hairline bg-canvas px-6 py-10 shadow-[0_18px_55px_rgba(16,23,32,0.06)] sm:px-10 sm:py-12 lg:px-16 lg:py-16">
        <div className="grid gap-12 lg:grid-cols-[1.35fr_0.65fr_0.65fr_0.65fr] lg:gap-14">
          <div>
            <Link href="/" className="inline-flex items-center gap-3 text-lg font-semibold tracking-[0] text-ink">
              <AgiraMark size={32} />
              Agira
            </Link>
            <p className="mt-6 max-w-md text-sm leading-7 text-body sm:text-base">
              Agira connects the master schedule, field planning, weekly commitments, and project risk so office and field teams build from the same live plan.
            </p>
            <div className="mt-7 flex items-center gap-3">
              <Link href="/sign-up" className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-xs font-semibold text-on-primary transition-colors hover:bg-primary-active">
                Get started
              </Link>
              <Link href="/sign-in" className="inline-flex h-10 items-center justify-center rounded-md border border-hairline px-4 text-xs font-semibold text-ink transition-colors hover:bg-surface-soft">
                Sign in
              </Link>
            </div>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <FooterColumn key={column.title} title={column.title} links={column.links} />
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-5 border-t border-hairline pt-7 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {new Date().getFullYear()} Agira. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/#why" className="underline decoration-hairline underline-offset-4 transition-colors hover:text-ink">Why Agira</Link>
            <Link href="/pricing" className="underline decoration-hairline underline-offset-4 transition-colors hover:text-ink">Pricing</Link>
            <Link href="/features/ai-assistant" className="underline decoration-hairline underline-offset-4 transition-colors hover:text-ink">Agent</Link>
          </div>
        </div>
      </div>

      <div className="relative mx-auto h-[clamp(90px,13vw,240px)] max-w-[1900px] overflow-hidden" aria-hidden="true">
        <p className="absolute bottom-[-0.38em] left-1/2 -translate-x-1/2 whitespace-nowrap text-center text-[clamp(3rem,13vw,15rem)] font-semibold leading-none tracking-[0] text-surface-strong">
          Agira
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: readonly (readonly [string, string])[] }) {
  return (
    <div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      <ul className="mt-5 space-y-4">
        {links.map(([label, href]) => (
          <li key={label}>
            <Link href={href} className="text-sm text-muted transition-colors hover:text-ink">{label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
