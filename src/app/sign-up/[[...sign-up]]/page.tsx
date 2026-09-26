import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { InfraTrackMark } from "@/components/landing/InfraTrackMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ShieldCheck, Sparkles } from "lucide-react";

export default function SignUpPage() {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-surface-dark px-4 py-12 text-on-dark">
      <div className="absolute top-5 right-5 z-20 flex items-center gap-3">
        <ThemeToggle className="group btn-interactive inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-pill border border-white/15 bg-white/10 text-white/90 shadow-sm transition-all hover:border-white/30 hover:bg-white/20 hover:text-white" />
      </div>
      {/* Background ambient aurora lighting */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-[450px] w-[600px] -translate-x-1/2 rounded-full bg-brand-accent/15 blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-40 right-1/4 h-[350px] w-[500px] rounded-full bg-success/10 blur-[100px]"
        aria-hidden
      />

      <div className="relative z-10 mb-8 flex flex-col items-center gap-3 text-center">
        <Link href="/" className="inline-flex items-center gap-2.5 transition-transform hover:scale-105">
          <InfraTrackMark size={36} />
          <span className="text-2xl font-bold tracking-tight text-white font-display">InfraTrack</span>
        </Link>
        <div className="inline-flex items-center gap-1.5 rounded-pill border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70 backdrop-blur-md">
          <Sparkles className="h-3 w-3 text-brand-accent" />
          <span>SIH 26122 Intelligent Schedule-Linking Engine</span>
        </div>
      </div>

      <div className="relative z-10 w-full max-w-md shadow-2xl">
        <SignUp fallbackRedirectUrl="/dashboard" forceRedirectUrl="/dashboard" />
      </div>

      <div className="relative z-10 mt-8 flex items-center gap-2 text-xs text-on-dark-soft">
        <ShieldCheck className="h-3.5 w-3.5 text-success" />
        <span>Self-hosted open-source core with enterprise security</span>
      </div>
    </div>
  );
}
