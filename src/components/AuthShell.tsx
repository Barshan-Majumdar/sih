import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AgiraMark } from "@/components/landing/AgiraMark";

type AuthShellProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <div className="grid h-dvh w-full grid-cols-1 bg-canvas lg:grid-cols-2">
      <aside className="relative hidden lg:block">
        <Image
          src="/auth/auth-panel.png"
          alt=""
          fill
          priority
          className="object-cover"
          sizes="50vw"
        />
        <div className="absolute inset-0 flex flex-col justify-between p-12 xl:p-16">
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Agira home">
            <AgiraMark size={30} />
            <span className="font-display text-lg tracking-[-0.02em] text-on-dark">Agira</span>
          </Link>
          <p className="max-w-sm text-[15px] leading-relaxed text-on-dark-soft">
            One place for the schedule, the field, and a project-aware Agent that proposes changes
            before anything is written.
          </p>
        </div>
      </aside>

      {/*
        No close affordance here: an X on a full-page route reads as "dismiss"
        with nothing to dismiss, and the wordmark already links home at both
        breakpoints (left panel on desktop, above the form on mobile).
      */}
      <section className="relative flex h-dvh flex-col overflow-y-auto px-6 py-8 sm:px-10">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-90">
            <Link href="/" className="mb-8 inline-flex items-center gap-2.5 lg:hidden">
              <AgiraMark size={28} />
              <span className="font-display text-lg tracking-[-0.02em] text-ink">Agira</span>
            </Link>

            <div className="mb-7">
              <h1 className="font-display text-[1.75rem] tracking-[-0.03em] text-ink">{title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-muted">{description}</p>
            </div>

            {children}

            <div className="mt-7 text-center text-sm text-muted">{footer}</div>
          </div>
        </div>
      </section>
    </div>
  );
}
