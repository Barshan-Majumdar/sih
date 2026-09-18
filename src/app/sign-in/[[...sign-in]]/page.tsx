import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { AgiraMark } from "@/components/landing/AgiraMark";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 px-4 py-12">
      <div className="mb-6 flex flex-col items-center gap-3">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <AgiraMark size={36} />
          <span className="text-xl font-bold tracking-tight text-white">InfraTrack AI</span>
        </Link>
        <p className="text-sm text-slate-400">SIH 26122 Intelligent Schedule-Linking Engine</p>
      </div>
      <SignIn />
    </div>
  );
}
