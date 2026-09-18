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
        {eyebrow && <p className="app-kicker mb-2">{eyebrow}</p>}
        <h1 className="app-page-title">{title}</h1>
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
          href={`/projects/${projectId}`}
          className="app-kicker mb-2 inline-flex items-center gap-1.5 transition-colors hover:text-ink"
        >
          {projectName}
          <span aria-hidden>/</span>
        </Link>
        <h1 className="app-page-title">{title}</h1>
        {description && <div className="app-page-description">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
