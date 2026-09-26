import Link from "next/link";
import type { ReactNode } from "react";

export function AppPageHeader({
  title,
  description,
  eyebrow,
  actions,
}: {
  title: string;
  description?: ReactNode;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="app-page-header">
      <div>
        {eyebrow && (
          <div className="mb-2.5 inline-flex items-center gap-1.5 rounded-pill border border-hairline/80 bg-surface-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-accent">
            {eyebrow}
          </div>
        )}
        <h1 className="app-page-title font-display">{title}</h1>
        {description && <div className="app-page-description">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ProjectPageHeader({
  projectId,
  projectName,
  title,
  description,
  actions,
}: {
  projectId: string;
  projectName: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="app-page-header">
      <div>
        <Link
          href={`/dashboard/${projectId}`}
          className="group mb-2.5 inline-flex items-center gap-1.5 rounded-pill border border-hairline/80 bg-surface-soft px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted transition-colors hover:border-brand-accent/30 hover:text-brand-accent"
        >
          <span>{projectName}</span>
          <span className="text-muted-soft group-hover:text-brand-accent" aria-hidden>/</span>
        </Link>
        <h1 className="app-page-title font-display">{title}</h1>
        {description && <div className="app-page-description">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
