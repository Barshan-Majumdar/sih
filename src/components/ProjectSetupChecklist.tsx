"use client";

import Link from "next/link";
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
  const steps = buildProjectSetupSteps(projectId, signals);
  const completed = completedProjectSetupSteps(steps);

  if (completed === steps.length) return null;

  function openAgent() {
    window.dispatchEvent(
      new CustomEvent("agira:toggle-assistant", { detail: { open: true } })
    );
  }

  return (
    <section className="mb-6 border-y border-hairline" aria-labelledby="project-setup-title">
      <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="project-setup-title" className="app-section-title">Project setup</h2>
          <p className="app-section-description">Complete the essentials, then this checklist gets out of the way.</p>
        </div>
        <div className="w-full sm:w-44">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span>{completed} of {steps.length} complete</span>
            <span>{Math.round((completed / steps.length) * 100)}%</span>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-surface-strong"
            role="progressbar"
            aria-label="Project setup progress"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={completed}
          >
            <span className="block h-full rounded-full bg-success" style={{ width: `${(completed / steps.length) * 100}%` }} />
          </div>
        </div>
      </div>

      <ol className="grid gap-px border-t border-hairline-soft bg-hairline-soft md:grid-cols-2 xl:grid-cols-5">
        {steps.map((step) => {
          const className = `flex min-h-24 items-start gap-3 bg-canvas px-3 py-4 text-left transition-colors ${
            step.complete ? "opacity-75" : "hover:bg-surface-soft"
          }`;

          return (
            <li key={step.id} className="bg-canvas">
              {step.complete ? (
                <div className={className}>
                  <StepContents step={step} />
                </div>
              ) : step.id === "first-agent-question" ? (
                <button type="button" onClick={openAgent} className={`${className} w-full`}>
                  <StepContents step={step} />
                </button>
              ) : (
                <Link href={step.href!} className={className}>
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
