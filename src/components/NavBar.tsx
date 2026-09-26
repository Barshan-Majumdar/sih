import Link from "next/link";
import { AppNavLinks } from "@/components/AppNavLinks";
import { OrgSwitcher } from "@/components/OrgSwitcher";
import { UserMenu } from "@/components/UserMenu";
import { AgiraMark } from "@/components/landing/AgiraMark";

export function NavBar() {
  return (
    <header className="sticky top-0 z-40 bg-app-bg/80 px-3 pb-2 pt-3 backdrop-blur-xl sm:px-4">
      <div className="mx-auto flex min-h-14 max-w-[1440px] items-center gap-3 rounded-2xl border border-hairline/80 bg-canvas/95 px-3.5 shadow-[0_8px_30px_rgba(15,23,42,0.05)] ring-1 ring-hairline-soft/80 backdrop-blur-md sm:gap-5 sm:px-5">
        <Link
          href="/dashboard"
          className="group inline-flex min-w-0 shrink-0 items-center gap-2.5"
          aria-label="Agira home"
        >
          <AgiraMark size={24} />
          <span className="hidden min-w-0 font-display text-sm font-semibold tracking-tight text-ink transition-opacity group-hover:opacity-80 sm:block">
            Agira
          </span>
        </Link>

        <AppNavLinks />

        <div className="min-w-0 flex-1" />
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
          <OrgSwitcher />
          <span className="hidden h-7 w-px bg-hairline-soft lg:block" aria-hidden />
          <UserMenu />
        </div>
      </div>
      <div className="mx-auto mt-2 max-w-[1440px] overflow-x-auto rounded-xl border border-hairline bg-canvas/95 py-1.5 shadow-[0_8px_22px_rgba(17,17,17,0.06)] md:hidden">
        <AppNavLinks mobile />
      </div>
    </header>
  );
}
