"use client";

import { Building2 } from "lucide-react";

export function OrgSwitcher() {
  return (
    <div className="inline-flex items-center gap-2 rounded-pill border border-hairline bg-surface-soft/80 px-3 py-1.5 text-xs font-semibold text-ink shadow-[0_1px_2px_rgba(15,23,42,0.03)] backdrop-blur-sm transition-all hover:border-hairline hover:bg-surface-soft">
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-accent/10 text-brand-accent">
        <Building2 size={12} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="truncate max-w-[150px] font-medium tracking-tight">OIL India Workspace</span>
    </div>
  );
}
