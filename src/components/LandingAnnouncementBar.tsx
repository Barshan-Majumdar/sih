import Link from "next/link";

export function LandingAnnouncementBar() {
  return (
    <Link
      href="#why"
      className="group flex h-9 w-full items-center justify-center gap-2 border-b border-white/10 bg-ink/85 px-4 text-[13px] font-medium text-white shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-md transition-colors hover:bg-ink/95"
    >
      <span className="truncate">
        Meet Agent: cited answers from your live schedule, confirmed before anything changes.
      </span>
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/25 transition-colors group-hover:border-white/45">
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </span>
    </Link>
  );
}
