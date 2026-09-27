"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, SignIn, SignUp } from "@clerk/nextjs";
import { ArrowLeft, ChevronDown, KeyRound, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAppTheme } from "@/lib/app-theme";
import { InfraTrackMark } from "@/components/landing/InfraTrackMark";

interface AuthShellProps {
  initialMode: "sign-in" | "sign-up";
}

export function AuthShell({ initialMode }: AuthShellProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"sign-in" | "sign-up">(initialMode);
  const { isDark } = useAppTheme();
  const { isLoaded, isSignedIn } = useAuth();

  // Bulletproof redirect when user completes authentication or is already signed in
  useEffect(() => {
    if (isLoaded && isSignedIn) {
      const searchParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      const redirectUrl = searchParams?.get("redirect_url") || "/dashboard";

      // 1. Immediately push client router
      router.replace(redirectUrl);

      // 2. Ensure hard navigation so server components, cookies, and middleware fully synchronize
      const timer = setTimeout(() => {
        if (typeof window !== "undefined" && !window.location.pathname.startsWith("/dashboard")) {
          window.location.href = redirectUrl;
        }
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [isLoaded, isSignedIn, router]);

  // Keep internal mode synced with initialMode when route changes
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const handleSwitchMode = (targetMode: "sign-in" | "sign-up") => {
    setMode(targetMode);
    const targetUrl = targetMode === "sign-in" ? "/sign-in" : "/sign-up";
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", targetUrl);
    }
  };

  const isSignUp = mode === "sign-up";

  // Common Clerk appearance matching InfraTrack design system
  const clerkAppearance = {
    layout: {
      socialButtonsPlacement: "top" as const,
      socialButtonsVariant: "blockButton" as const,
    },
    variables: {
      colorPrimary: isDark ? "#3b82f6" : "#0f172a",
      colorBackground: "transparent",
      colorText: isDark ? "#ffffff" : "#0f172a",
      colorTextSecondary: isDark ? "#a1a1aa" : "#64748b",
      colorInputBackground: isDark ? "#121215" : "#ffffff",
      colorInputText: isDark ? "#ffffff" : "#0f172a",
      borderRadius: "0.75rem",
      fontFamily: "inherit",
    },
    elements: {
      rootBox: "!w-full !max-w-none !overflow-visible",
      cardBox: "!w-full !max-w-none !shadow-none !border-none !bg-transparent !p-0 !overflow-visible",
      card: "!shadow-none !border-none !bg-transparent !p-0 !pt-1 !w-full !max-w-none !overflow-visible",
      main: "!overflow-visible",
      socialButtonsRoot: "!w-full !overflow-visible",
      socialButtons: "!w-full !overflow-visible",
      socialButtonsBlockButtonBadge: "!hidden",
      socialButtonsBlockButtonBadge__lastUsed: "!hidden",
      socialButtonsIconButtonBadge: "!hidden",
      header: "!hidden",
      headerTitle: "!hidden",
      headerSubtitle: "!hidden",
      formButtonPrimary: isDark
        ? "!btn-interactive !w-full !rounded-pill !bg-blue-600 hover:!bg-blue-700 !text-white !font-semibold !h-11 !text-sm !shadow-md transition-all"
        : "!btn-interactive !w-full !rounded-pill !bg-slate-900 hover:!bg-black !text-white !font-semibold !h-11 !text-sm !shadow-md transition-all",
      formFieldInput: isDark
        ? "!bg-[#121215] !border !border-white/10 !text-white !rounded-xl !h-11 !px-3.5 focus:!border-blue-500 focus:!ring-2 focus:!ring-blue-500/20 placeholder:!text-zinc-500"
        : "!bg-white !border !border-slate-300 !text-slate-900 !rounded-xl !h-11 !px-3.5 focus:!border-slate-900 focus:!ring-2 focus:!ring-slate-900/10 placeholder:!text-slate-400",
      formFieldLabel:
        `!text-xs !font-semibold ${isDark ? "!text-zinc-300" : "!text-slate-700"} !mb-1`,
      dividerLine: isDark ? "!bg-white/[0.08]" : "!bg-slate-200",
      dividerText: isDark ? "!text-xs !uppercase !text-zinc-500 !font-medium" : "!text-xs !uppercase !text-slate-400 !font-medium",
      socialButtonsIconButton: isDark
        ? "!border !border-white/10 !bg-[#121215] hover:!bg-[#1a1a20] !text-white !rounded-full !h-10 !w-10 !transition-colors !shadow-sm"
        : "!border !border-slate-300 !bg-white hover:!bg-slate-50 !text-slate-800 !rounded-full !h-10 !w-10 !transition-colors !shadow-2xs",
      socialButtonsBlockButton: isDark
        ? "!relative !border !border-white/10 !bg-[#121215] hover:!bg-[#18181e] !text-white !rounded-xl !h-11 !text-sm !font-medium !overflow-visible"
        : "!relative !border !border-slate-300 !bg-white hover:!bg-slate-50 !text-slate-800 !rounded-xl !h-11 !text-sm !font-medium !shadow-2xs !overflow-visible",
      footer: "!hidden !bg-transparent",
      footerAction: "!hidden",
      footerActionText: "!hidden",
      footerActionLink: "!hidden",
      footerPages: "!hidden",
      identityPreviewText: isDark ? "!text-zinc-200" : "!text-slate-800",
      identityPreviewEditButton: isDark ? "!text-blue-500 !font-semibold" : "!text-slate-900 !font-semibold hover:underline",
    },
  };

  return (
    <div
      className={`relative flex min-h-screen md:min-h-0 md:h-screen w-full items-center justify-center p-3 sm:p-4 md:py-3 md:px-5 lg:py-5 lg:px-6 transition-colors duration-500 overflow-x-hidden overflow-y-auto ${
        isDark
          ? "bg-[#000000] text-white"
          : "bg-gradient-to-br from-[#f1f5f9] via-[#f8fafc] to-[#e2e8f0] text-slate-900"
      }`}
    >
      {/* Ambient background light glows (contained in overflow-hidden so they NEVER cause scrollbars) */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div
          className={`absolute -top-40 left-1/2 h-[550px] w-[700px] -translate-x-1/2 rounded-full blur-[140px] transition-opacity duration-700 ${
            isDark ? "bg-blue-600/10 opacity-70" : "bg-slate-300/30 opacity-60"
          }`}
        />
        <div
          className={`absolute -bottom-40 right-1/4 h-[400px] w-[500px] rounded-full blur-[120px] transition-opacity duration-700 ${
            isDark ? "bg-violet-600/10 opacity-60" : "bg-slate-200/40 opacity-50"
          }`}
        />
      </div>

      {/* Main Floating Card Container with Curved Corners */}
      <div
        className={`relative z-10 w-full max-w-[1080px] h-auto md:h-[min(680px,calc(100vh-2.5rem))] md:min-h-[540px] rounded-[28px] sm:rounded-[36px] overflow-hidden transition-all duration-500 ${
          isDark
            ? "bg-[#09090b] border border-white/[0.08] shadow-[0_24px_60px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]"
            : "bg-white border border-slate-200/90 shadow-[0_24px_70px_rgba(15,23,42,0.10)]"
        }`}
      >
        {/* =========================================================================
            DESKTOP SLIDING DECORATIVE PANEL
            - On Sign-Up: sits at translate-x-full (Right Half)
            - On Sign-In: slides across to translate-x-0 (Left Half)
            - Weighted physics with Apple luxury easing [cubic-bezier(0.76,0,0.24,1)]
            ========================================================================= */}
        <div
          className={`absolute top-0 bottom-0 left-0 w-1/2 z-30 hidden md:block transition-transform duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] overflow-hidden ${
            isSignUp ? "translate-x-full" : "translate-x-0"
          }`}
        >
          {/* Decorative Panel Content */}
          <DecorativePanelContent isDark={isDark} mode={mode} />
        </div>

        {/* =========================================================================
            DESKTOP 2-COLUMN INNER LAYOUT
            Both forms stay pre-rendered in DOM with smooth parallax cross-fade
            ========================================================================= */}
        <div className="relative flex flex-col md:flex-row w-full h-full">
          {/* ───────────────────────────────────────────────────────────────────────
              LEFT COLUMN (Sign Up Form Slot)
              ─────────────────────────────────────────────────────────────────────── */}
          <div
            className={`w-full md:w-1/2 flex flex-col justify-between p-6 sm:p-8 md:p-10 transition-all duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              isSignUp
                ? "opacity-100 translate-x-0 pointer-events-auto"
                : "opacity-0 md:-translate-x-8 pointer-events-none hidden md:flex"
            }`}
          >
            {/* Top Navigation Row */}
            <div className="shrink-0 flex items-center justify-between gap-4">
              <Link
                href="/"
                className={`btn-interactive inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-2xs transition-all ${
                  isDark
                    ? "border-white/10 bg-[#121215] text-white hover:bg-[#1a1a20]"
                    : "border-slate-300 bg-slate-50/90 text-slate-800 hover:bg-slate-100 hover:border-slate-400"
                }`}
                aria-label="Back to home"
                title="Back to home"
              >
                <ArrowLeft size={16} strokeWidth={2.2} />
              </Link>

              <div className={`text-xs ${isDark ? "text-zinc-400" : "text-slate-600"}`}>
                Already member?{" "}
                <button
                  type="button"
                  onClick={() => handleSwitchMode("sign-in")}
                  className={`font-semibold ${isDark ? "text-blue-400" : "text-slate-900"} hover:underline cursor-pointer`}
                >
                  Sign in
                </button>
              </div>
            </div>

            {/* Sign Up Form Content - Centered */}
            <div className="flex-1 flex flex-col justify-center w-full max-w-sm mx-auto py-2">
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2.5">
                  <InfraTrackMark size={32} />
                  <span
                    className={`font-brand font-black italic text-[28px] sm:text-[32px] tracking-tight leading-none pr-1 select-none ${
                      isDark
                        ? "text-white drop-shadow-[0_2px_14px_rgba(255,255,255,0.2)]"
                        : "text-slate-950"
                    }`}
                  >
                    InfraTrack
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <h1
                    className={`text-3xl font-extrabold font-display tracking-tight ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Sign Up
                  </h1>
                  <span className={`${isDark ? "text-zinc-600" : "text-slate-400"} text-lg rotate-12 select-none`} aria-hidden>
                    ⤷
                  </span>
                </div>
                <p className={`text-xs mt-1 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                  Secure Your Operations with InfraTrack
                </p>
              </div>

              {/* Clerk Sign Up Form */}
              <div className="auth-clerk-shell w-full min-h-[300px]">
                {isSignedIn ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 animate-in fade-in duration-300">
                    <div className={`h-8 w-8 animate-spin rounded-full border-2 ${isDark ? "border-blue-500" : "border-slate-900"} border-t-transparent`} />
                    <p className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                      Account ready! Redirecting to dashboard...
                    </p>
                  </div>
                ) : isSignUp ? (
                  <SignUp
                    path="/sign-up"
                    routing="path"
                    fallbackRedirectUrl="/dashboard"
                    forceRedirectUrl="/dashboard"
                    signInFallbackRedirectUrl="/dashboard"
                    signInForceRedirectUrl="/dashboard"
                    appearance={clerkAppearance}
                  />
                ) : null}
              </div>
            </div>

            {/* Bottom Row */}
            <div
              className={`shrink-0 flex items-center justify-between pt-3 border-t text-xs ${
                isDark ? "border-white/[0.06] text-zinc-400" : "border-slate-100 text-slate-500"
              }`}
            >
              <div className="inline-flex items-center gap-1.5 font-medium">
                <span>🇬🇧 ENG</span>
                <ChevronDown size={13} className="text-slate-400" />
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggle
                  className={`btn-interactive inline-flex h-8 w-8 items-center justify-center rounded-full border shadow-2xs transition-all ${
                    isDark
                      ? "border-white/10 bg-[#121215] text-white hover:bg-[#1a1a20]"
                      : "border-slate-300 bg-slate-50/90 text-slate-700 hover:bg-slate-100 hover:border-slate-400"
                  }`}
                />
              </div>
            </div>
          </div>

          {/* ───────────────────────────────────────────────────────────────────────
              RIGHT COLUMN (Sign In Form Slot)
              ─────────────────────────────────────────────────────────────────────── */}
          <div
            className={`w-full md:w-1/2 flex flex-col justify-between p-6 sm:p-8 md:p-10 transition-all duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] ${
              !isSignUp
                ? "opacity-100 translate-x-0 pointer-events-auto"
                : "opacity-0 md:translate-x-8 pointer-events-none hidden md:flex"
            }`}
          >
            {/* Top Navigation Row */}
            <div className="shrink-0 flex items-center justify-between gap-4">
              <Link
                href="/"
                className={`btn-interactive inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-2xs transition-all ${
                  isDark
                    ? "border-white/10 bg-[#121215] text-white hover:bg-[#1a1a20]"
                    : "border-slate-300 bg-slate-50/90 text-slate-800 hover:bg-slate-100 hover:border-slate-400"
                }`}
                aria-label="Back to home"
                title="Back to home"
              >
                <ArrowLeft size={16} strokeWidth={2.2} />
              </Link>

              <div className={`text-xs ${isDark ? "text-zinc-400" : "text-slate-600"}`}>
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => handleSwitchMode("sign-up")}
                  className={`font-semibold ${isDark ? "text-blue-400" : "text-slate-900"} hover:underline cursor-pointer`}
                >
                  Sign up
                </button>
              </div>
            </div>

            {/* Sign In Form Content - Centered */}
            <div className="flex-1 flex flex-col justify-center w-full max-w-sm mx-auto py-2">
              <div className="mb-4">
                <div className="flex items-center gap-3 mb-2.5">
                  <InfraTrackMark size={32} />
                  <span
                    className={`font-brand font-black italic text-[28px] sm:text-[32px] tracking-tight leading-none pr-1 select-none ${
                      isDark
                        ? "text-white drop-shadow-[0_2px_14px_rgba(255,255,255,0.2)]"
                        : "text-slate-950"
                    }`}
                  >
                    InfraTrack
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <h1
                    className={`text-3xl font-extrabold font-display tracking-tight ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    Welcome Back
                  </h1>
                  <span className={`${isDark ? "text-zinc-600" : "text-slate-400"} text-lg rotate-12 select-none`} aria-hidden>
                    ⤷
                  </span>
                </div>
                <p className={`text-xs mt-1 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                  Access Your Infrastructure Project Controls
                </p>
              </div>

              {/* Clerk Sign In Form */}
              <div className="auth-clerk-shell w-full min-h-[300px]">
                {isSignedIn ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 animate-in fade-in duration-300">
                    <div className={`h-8 w-8 animate-spin rounded-full border-2 ${isDark ? "border-blue-500" : "border-slate-900"} border-t-transparent`} />
                    <p className={`text-sm font-medium ${isDark ? "text-zinc-300" : "text-slate-600"}`}>
                      Signing you in... Redirecting to dashboard...
                    </p>
                  </div>
                ) : !isSignUp ? (
                  <SignIn
                    path="/sign-in"
                    routing="path"
                    fallbackRedirectUrl="/dashboard"
                    forceRedirectUrl="/dashboard"
                    signUpFallbackRedirectUrl="/dashboard"
                    signUpForceRedirectUrl="/dashboard"
                    appearance={clerkAppearance}
                  />
                ) : null}
              </div>
            </div>

            {/* Bottom Row */}
            <div
              className={`shrink-0 flex items-center justify-between pt-3 border-t text-xs ${
                isDark ? "border-white/[0.06] text-zinc-400" : "border-slate-100 text-slate-500"
              }`}
            >
              <div className="inline-flex items-center gap-1.5 font-medium">
                <span>🇬🇧 ENG</span>
                <ChevronDown size={13} className="text-slate-400" />
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggle
                  className={`btn-interactive inline-flex h-8 w-8 items-center justify-center rounded-full border shadow-2xs transition-all ${
                    isDark
                      ? "border-white/10 bg-[#121215] text-white hover:bg-[#1a1a20]"
                      : "border-slate-300 bg-slate-50/90 text-slate-700 hover:bg-slate-100 hover:border-slate-400"
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Header Banner (screens < md) */}
        <div className="block md:hidden w-full order-first">
          <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-black text-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <InfraTrackMark size={28} />
              <span className="font-brand font-black italic text-[22px] tracking-tight text-white pr-0.5 select-none">
                InfraTrack
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSwitchMode(isSignUp ? "sign-in" : "sign-up")}
                className="rounded-pill bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm"
              >
                {isSignUp ? "Sign In →" : "Sign Up →"}
              </button>
              <ThemeToggle className="h-8 w-8 rounded-full border border-white/20 bg-white/10 text-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OBSIDIAN & CHARCOAL DECORATIVE PRESENTATION PANEL
// (Features layered organic wave curves, metrics card, "Your data, your rules"
// card, and floating badge accents matching the landing page)
// ─────────────────────────────────────────────────────────────────────────────
function DecorativePanelContent({
  isDark,
  mode,
}: {
  isDark: boolean;
  mode: "sign-in" | "sign-up";
}) {
  return (
    <div
      className={`relative w-full h-full flex flex-col justify-center items-center p-8 lg:p-12 overflow-hidden transition-colors duration-500 select-none ${
        isDark
          ? "bg-gradient-to-br from-[#0c0d12] via-[#09090b] to-[#040406]"
          : "bg-gradient-to-br from-[#090d14] via-[#0f172a] to-[#020617]"
      }`}
    >
      {/* Layered Organic Wave SVGs matching the image's curved backdrop */}
      <svg
        className="pointer-events-none absolute inset-0 w-full h-full object-cover"
        viewBox="0 0 600 720"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="midWaveGrad" x1="0" y1="340" x2="600" y2="720" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1e293b" stopOpacity={isDark ? "0.35" : "0.55"} />
            <stop offset="100%" stopColor="#090d14" stopOpacity={isDark ? "0.08" : "0.2"} />
          </linearGradient>
          <linearGradient id="bottomBulgeGrad" x1="0" y1="460" x2="390" y2="720" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#334155" stopOpacity={isDark ? "0.45" : "0.65"} />
            <stop offset="100%" stopColor="#0f172a" stopOpacity={isDark ? "0.15" : "0.3"} />
          </linearGradient>
        </defs>

        {/* 1. Middle Sweeping Diagonal Layer */}
        <path
          d="M0 340 C140 380 260 300 420 320 C520 330 580 400 600 420 V720 H0 Z"
          fill="url(#midWaveGrad)"
        />

        {/* 2. Bottom-Left Fluid Bulge / Wave Lobe */}
        <path
          d="M0 480 C50 450 130 440 210 475 C290 510 330 610 390 720 H0 Z"
          fill="url(#bottomBulgeGrad)"
        />

        {/* 3. Top-Right Ambient Scoop Wave matching Card Background */}
        <path
          d="M320 0 C380 45 430 75 490 40 C540 10 575 50 600 65 V0 H320 Z"
          fill={isDark ? "#09090b" : "#ffffff"}
          className="transition-colors duration-500"
        />

        {/* 4. Top-Left Organic Curved Flap / Ribbon Edge */}
        <path
          d="M0 0 V60 C0 92 32 120 72 120 C112 120 140 92 140 55 C140 25 160 0 185 0 Z"
          fill={isDark ? "#16161a" : "#1e293b"}
          stroke={isDark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.18)"}
          strokeWidth="1.5"
          className="transition-colors duration-500"
        />
      </svg>

      {/* ───────────────────────────────────────────────────────────────────────
          FLOATING ELEMENT 1: TOP METRIC CARD ("Inbox" / "176,18")
          ─────────────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[270px] mb-8 animate-[bounce_8s_ease-in-out_infinite]">
        <div
          className={`rounded-[22px] p-5 transition-all duration-300 ${
            isDark
              ? "bg-[#111114] border border-white/[0.08] shadow-[0_20px_45px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
              : "bg-white border border-slate-100 shadow-[0_20px_45px_rgba(15,23,42,0.14)]"
          }`}
        >
          {/* Label */}
          <div
            className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${
              isDark ? "text-sky-400" : "text-slate-800"
            }`}
          >
            WBS Progress
          </div>

          {/* Metric Value */}
          <div className={`text-3xl font-extrabold font-display tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
            176,18
          </div>

          {/* Multi-Color Spline Chart with Floating "45" Badge */}
          <div className="relative mt-3 h-12 w-full">
            <svg
              className="w-full h-full overflow-visible"
              viewBox="0 0 200 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor={isDark ? "#38bdf8" : "#0f172a"} />
                  <stop offset="35%" stopColor={isDark ? "#818cf8" : "#334155"} />
                  <stop offset="65%" stopColor={isDark ? "#3b82f6" : "#64748b"} />
                  <stop offset="100%" stopColor={isDark ? "#60a5fa" : "#0f172a"} />
                </linearGradient>
              </defs>
              <path
                d="M5 38C25 38 40 18 60 22C80 26 95 6 115 10C135 14 150 42 170 30C185 20 195 24 200 24"
                stroke="url(#chartGradient)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {/* Floating Circle Badge with "45" over the valley */}
            <div className={`absolute top-0 left-[105px] -translate-x-1/2 -translate-y-1 h-7 w-7 rounded-full text-[11px] font-bold flex items-center justify-center shadow-lg ring-2 ${
              isDark
                ? "bg-white text-black ring-black/40"
                : "bg-slate-900 text-white ring-white"
            }`}>
              45
            </div>
          </div>
        </div>

        {/* Floating Sunset / Cyan Gradient Circle on Top-Right */}
        <div
          className={`absolute -top-3 -right-12 h-11 w-11 rounded-full flex items-center justify-center text-white shadow-xl ring-4 ring-white/10 animate-pulse ${
            isDark
              ? "bg-gradient-to-tr from-cyan-500 via-blue-600 to-violet-600"
              : "bg-gradient-to-tr from-slate-900 via-slate-800 to-zinc-700"
          }`}
        >
          <Sparkles size={18} />
        </div>

        {/* Floating Dark Circle on Mid-Right */}
        <div className="absolute top-16 -right-8 h-10 w-10 rounded-full bg-[#16161a] border border-white/10 text-white flex items-center justify-center shadow-xl ring-4 ring-black/40">
          <InfraTrackMark size={16} />
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────────────────
          FLOATING ELEMENT 2: BOTTOM CARD ("Your data, your rules")
          ─────────────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-[340px]">
        <div
          className={`rounded-[22px] p-5 transition-all duration-300 ${
            isDark
              ? "bg-[#111114] border border-white/[0.08] shadow-[0_20px_45px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl"
              : "bg-white border border-slate-100 shadow-[0_20px_45px_rgba(15,23,42,0.14)]"
          }`}
        >
          <div className="flex items-start gap-4">
            {/* Left Column: 3 Skeleton Bars */}
            <div className="flex flex-col gap-2 pt-1">
              <div className={`h-1.5 w-10 rounded-full ${isDark ? "bg-white/80" : "bg-slate-900"}`} />
              <div className={`h-1.5 w-14 rounded-full ${isDark ? "bg-[#27272a]" : "bg-slate-200"}`} />
              <div className={`h-1.5 w-8 rounded-full ${isDark ? "bg-[#1c1c20]" : "bg-slate-100"}`} />
            </div>

            {/* Right Column: Key Icon + Title + Description */}
            <div className="flex-1">
              <div
                className={`h-9 w-9 rounded-xl flex items-center justify-center mb-2.5 transition-colors ${
                  isDark
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                    : "bg-slate-100 text-slate-900 border border-slate-200"
                }`}
              >
                <KeyRound size={18} strokeWidth={2.2} />
              </div>

              <div className={`text-sm font-bold font-display ${isDark ? "text-white" : "text-slate-900"}`}>
                Your data, your rules
              </div>

              <p className={`text-[11px] leading-relaxed mt-1 ${isDark ? "text-zinc-400" : "text-slate-500"}`}>
                Your data belongs to you, and our self-hosted zero-knowledge encryption ensures that.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Subtle indicator pill at bottom of decorative panel */}
      <div className={`absolute bottom-5 z-10 text-[10px] font-semibold tracking-widest uppercase ${
        isDark ? "text-zinc-500" : "text-white/60"
      }`}>
        {mode === "sign-up" ? "Create Workspace" : "Access Workspace"}
      </div>
    </div>
  );
}

export default AuthShell;
