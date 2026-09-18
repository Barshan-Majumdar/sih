"use client";

import { Building2 } from "lucide-react";

export function OrgSwitcher() {
  return (
    <div className="flex items-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-800/60 px-3 py-1 text-xs font-medium text-slate-200">
      <Building2 size={13} className="text-blue-400" />
      <span className="truncate max-w-[140px]">OIL India Workspace</span>
    </div>
  );
}
