import Link from "next/link";

export function LandingAnnouncementBar() {
  return (
    <Link
      href="#why"
      className="landing-announcement-bar group flex h-9 w-full items-center justify-center gap-2 border-b px-4 text-[13px] font-medium backdrop-blur-md transition-colors"
    >
      <span className="truncate">
        Meet Agent: cited answers from your live schedule, confirmed before anything changes.
      </span>
      <span className="announcement-arrow-circle inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors">
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
