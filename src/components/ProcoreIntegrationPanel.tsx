"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  disconnectProcore,
  setProcoreProjectMapping,
  syncProcoreProject,
  type ProcoreSyncSummary,
} from "@/app/actions/procore";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { Card } from "@/components/ui/Card";

type ProjectRow = {
  id: string;
  name: string;
  procoreProjectId: string | null;
};

type ProcoreProjectOption = {
  id: number;
  name: string;
  project_number?: string | null;
};

export function ProcoreIntegrationPanel({
  isConfigured,
  isProPlan,
  isOwner,
  isConnected,
  companyName,
  projects,
  procoreProjects,
}: {
  isConfigured: boolean;
  isProPlan: boolean;
  isOwner: boolean;
  isConnected: boolean;
  companyName: string | null;
  projects: ProjectRow[];
  procoreProjects: ProcoreProjectOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<ProcoreSyncSummary | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isConfigured) {
    return (
      <Card className="p-6">
        <h2 className="app-card-title mb-2">Procore</h2>
        <p className="text-sm text-muted">
          Procore isn&apos;t configured on this server yet. Add{" "}
          <code className="text-xs">PROCORE_CLIENT_ID</code> and{" "}
          <code className="text-xs">PROCORE_CLIENT_SECRET</code> from the{" "}
          <a href="https://developers.procore.com" className="underline hover:text-ink" target="_blank" rel="noreferrer">
            Procore Developer Portal
          </a>{" "}
          (sandbox credentials are fine for testing).
        </p>
      </Card>
    );
  }

  if (!isProPlan) {
    return (
      <Card className="p-6">
        <h2 className="app-card-title mb-2">Procore</h2>
        <p className="text-sm text-muted mb-4">
          Pull RFIs and Submittals from Procore into your projects. This integration is included on the{" "}
          <strong>Pro</strong> plan.
        </p>
        {isOwner ? (
          <Link href="/plan">
            <Button>View plan</Button>
          </Link>
        ) : (
          <p className="text-sm text-muted">Ask your organization owner to upgrade the plan.</p>
        )}
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card className="p-6">
        <h2 className="app-card-title mb-2">Procore</h2>
        <p className="text-sm text-muted">Only the organization owner can connect or sync Procore.</p>
        {isConnected && companyName && (
          <p className="text-xs text-muted-soft mt-2">Connected to {companyName}</p>
        )}
      </Card>
    );
  }

  function disconnect() {
    setError(null);
    startTransition(async () => {
      const result = await disconnectProcore();
      if (!result.success) setError(result.error);
      else window.location.reload();
    });
  }

  function saveMapping(projectId: string, procoreProjectId: string) {
    setError(null);
    startTransition(async () => {
      const result = await setProcoreProjectMapping({
        projectId,
        procoreProjectId: procoreProjectId || null,
      });
      if (!result.success) setError(result.error);
    });
  }

  function syncProject(projectId: string) {
    setError(null);
    setSyncResult(null);
    startTransition(async () => {
      const result = await syncProcoreProject({ projectId });
      if (!result.success) setError(result.error);
      else setSyncResult(result.data);
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="app-card-title mb-1">Procore</h2>
          <p className="text-sm text-muted">
            Connect your Procore sandbox account, map projects, then pull RFIs and Submittals into Agira.
          </p>
        </div>
        {isConnected ? (
          <Button variant="secondary" onClick={disconnect} disabled={pending}>
            Disconnect
          </Button>
        ) : (
          <a href="/api/integrations/procore/connect">
            <Button disabled={pending}>Connect Procore</Button>
          </a>
        )}
      </div>

      {isConnected && companyName && (
        <p className="text-xs text-muted-soft mb-4">
          Connected to <strong>{companyName}</strong>
        </p>
      )}

      {isConnected && projects.length > 0 && (
        <div className="space-y-4 border-t border-hairline pt-4">
          <p className="app-table-heading">Project mapping</p>
          {projects.map((project) => (
            <ProjectMappingRow
              key={project.id}
              project={project}
              procoreProjects={procoreProjects}
              pending={pending}
              onSave={saveMapping}
              onSync={syncProject}
            />
          ))}
        </div>
      )}

      {syncResult && (
        <p className="text-sm text-success mt-4">
          Sync complete — {syncResult.rfis.created} RFIs created, {syncResult.rfis.updated} updated;{" "}
          {syncResult.submittals.created} submittals created, {syncResult.submittals.updated} updated.
        </p>
      )}

      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function ProjectMappingRow({
  project,
  procoreProjects,
  pending,
  onSave,
  onSync,
}: {
  project: ProjectRow;
  procoreProjects: ProcoreProjectOption[];
  pending: boolean;
  onSave: (projectId: string, procoreProjectId: string) => void;
  onSync: (projectId: string) => void;
}) {
  const [selected, setSelected] = useState(project.procoreProjectId ?? "");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium min-w-[12rem]">{project.name}</span>
      <select
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          onSave(project.id, e.target.value);
        }}
        disabled={pending}
        className="text-sm border border-hairline rounded-md px-2 py-1.5 bg-canvas min-w-[14rem]"
      >
        <option value="">Not linked</option>
        {procoreProjects.map((p) => (
          <option key={p.id} value={String(p.id)}>
            {p.name}
            {p.project_number ? ` (${p.project_number})` : ""}
          </option>
        ))}
      </select>
      <Button
        variant="secondary"
        onClick={() => onSync(project.id)}
        disabled={pending || !selected}
      >
        Sync now
      </Button>
    </div>
  );
}
