"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Circle } from "lucide-react";
import {
  buildProjectSetupSteps,
  completedProjectSetupSteps,
  type ProjectSetupSignals,
  type ProjectSetupStep,
} from "@/lib/project-onboarding";

function StepStatus({ complete }: { complete: boolean }) {
  return complete ? (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white">
      <Check size={12} strokeWidth={2.5} aria-hidden />
    </span>
  ) : (
    <Circle size={20} strokeWidth={1.5} className="shrink-0 text-muted-soft" aria-hidden />
  );
}

function StepContents({ step }: { step: ProjectSetupStep }) {
  return (
    <>
      <StepStatus complete={step.complete} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{step.label}</span>
        <span className="mt-0.5 block text-xs leading-5 text-muted">{step.description}</span>
      </span>
      {!step.complete && <ArrowUpRight size={15} className="shrink-0 text-muted-soft" aria-hidden />}
    </>
  );
}

export function ProjectSetupChecklist({
  projectId,
  signals,
}: {
  projectId: string;
  signals: ProjectSetupSignals;
}) {
  const router = useRouter();
  const steps = buildProjectSetupSteps(projectId, signals);
  const completed = completedProjectSetupSteps(steps);

  if (completed === steps.length) return null;

  function openAgent() {
    router.push("/agent");
  }

  return (
    <section className="mb-6 rounded-2xl border border-hairline bg-surface-soft/60 p-5 shadow-card" aria-labelledby="project-setup-title">
      <div className="flex flex-col gap-3 pb-4 border-b border-hairline sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Onboarding</p>
          <h2 id="project-setup-title" className="text-base font-bold tracking-tight text-ink mt-0.5">Project Setup Progress</h2>
          <p className="text-xs text-muted mt-0.5">Complete the essentials, then this checklist automatically gets out of the way.</p>
        </div>
        <div className="w-full sm:w-48">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted font-mono">
            <span>{completed} of {steps.length} complete</span>
            <span className="font-bold text-ink">{Math.round((completed / steps.length) * 100)}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-hairline/80"
            role="progressbar"
            aria-label="Project setup progress"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={completed}
          >
            <span
              className="block h-full rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${(completed / steps.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {steps.map((step) => {
          const cardClass = `btn-interactive flex min-h-[96px] items-start gap-3 rounded-xl border border-hairline bg-canvas p-3.5 text-left transition-all ${
            step.complete
              ? "opacity-75 bg-surface-soft/50 shadow-2xs"
              : "shadow-2xs hover:shadow-card hover:border-ink/20"
          }`;

          return (
            <li key={step.id}>
              {step.complete ? (
                <div className={cardClass}>
                  <StepContents step={step} />
                </div>
              ) : step.id === "first-agent-question" ? (
                <button type="button" onClick={openAgent} className={`${cardClass} w-full`}>
                  <StepContents step={step} />
                </button>
              ) : (
                <Link href={step.href!} className={cardClass}>
                  <StepContents step={step} />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
