import Link from "next/link";

const TABS = [
  { href: "/dashboard", label: "Executive Dashboard" },
  { href: "/timeline", label: "Timeline" },
  { href: "/trade-performance", label: "Trade Performance" },
];

export function OrgSubNav({ active }: { active: string }) {
  return (
    <nav aria-label="Portfolio views" className="w-full overflow-x-auto border-b border-hairline">
      <div className="flex w-max min-w-full items-center gap-6">
        {TABS.map((tab) => {
          const isActive = tab.label === active;
          return (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`relative shrink-0 whitespace-nowrap border-b-2 px-0.5 pb-3 pt-1 text-sm font-medium transition-colors ${
                isActive ? "border-ink text-ink" : "border-transparent text-muted hover:border-hairline hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
