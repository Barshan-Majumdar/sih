"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  disconnectAutodesk,
  setAutodeskProjectMapping,
  syncAutodeskProject,
  type AutodeskSyncSummary,
} from "@/app/actions/autodesk";
import { Button } from "@/components/ui/Button";
import { ErrorText } from "@/components/ui/ErrorText";
import { Card } from "@/components/ui/Card";

type ProjectRow = {
  id: string;
  name: string;
  autodeskProjectId: string | null;
};

type AutodeskProjectOption = {
  id: string;
  attributes: { name: string };
};

export function AutodeskIntegrationPanel({
  isConfigured,
  isProPlan,
  isOwner,
  isConnected,
  hubName,
  projects,
  autodeskProjects,
}: {
  isConfigured: boolean;
  isProPlan: boolean;
  isOwner: boolean;
  isConnected: boolean;
  hubName: string | null;
  projects: ProjectRow[];
  autodeskProjects: AutodeskProjectOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<AutodeskSyncSummary | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isConfigured) {
    return (
      <Card className="p-6">
        <h2 className="app-card-title mb-2">Autodesk Construction Cloud</h2>
        <p className="text-sm text-muted">
          Autodesk isn&apos;t configured on this server yet. Add{" "}
          <code className="text-xs">AUTODESK_CLIENT_ID</code> and{" "}
          <code className="text-xs">AUTODESK_CLIENT_SECRET</code> from{" "}
          <a href="https://aps.autodesk.com" className="underline hover:text-ink" target="_blank" rel="noreferrer">
            Autodesk Platform Services
          </a>{" "}
          (free tier is fine for testing).
        </p>
      </Card>
    );
  }

  if (!isProPlan) {
    return (
      <Card className="p-6">
        <h2 className="app-card-title mb-2">Autodesk Construction Cloud</h2>
        <p className="text-sm text-muted mb-4">
          Pull PDF drawings from ACC into your projects. Included on the <strong>Pro</strong> plan.
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
        <h2 className="app-card-title mb-2">Autodesk Construction Cloud</h2>
        <p className="text-sm text-muted">Only the organization owner can connect or sync Autodesk.</p>
        {isConnected && hubName && <p className="text-xs text-muted-soft mt-2">Connected to {hubName}</p>}
      </Card>
    );
  }

  function disconnect() {
    setError(null);
    startTransition(async () => {
      const result = await disconnectAutodesk();
      if (!result.success) setError(result.error);
      else window.location.reload();
    });
  }

  function saveMapping(projectId: string, autodeskProjectId: string) {
    setError(null);
    startTransition(async () => {
      const result = await setAutodeskProjectMapping({ projectId, autodeskProjectId: autodeskProjectId || null });
      if (!result.success) setError(result.error);
    });
  }

  function syncProject(projectId: string) {
    setError(null);
    setSyncResult(null);
    startTransition(async () => {
      const result = await syncAutodeskProject({ projectId });
      if (!result.success) setError(result.error);
      else setSyncResult(result.data);
    });
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="app-card-title mb-1">Autodesk Construction Cloud</h2>
          <p className="text-sm text-muted">
            Connect ACC, map projects, then pull PDF drawings into Agira.
          </p>
        </div>
        {isConnected ? (
          <Button variant="secondary" onClick={disconnect} disabled={pending}>
            Disconnect
          </Button>
        ) : (
          <a href="/api/integrations/autodesk/connect">
            <Button disabled={pending}>Connect Autodesk</Button>
          </a>
        )}
      </div>

      {isConnected && hubName && (
        <p className="text-xs text-muted-soft mb-4">
          Connected to hub <strong>{hubName}</strong>
        </p>
      )}

      {isConnected && projects.length > 0 && (
        <div className="space-y-4 border-t border-hairline pt-4">
          <p className="app-table-heading">Project mapping</p>
          {projects.map((project) => (
            <ProjectMappingRow
              key={project.id}
              project={project}
              autodeskProjects={autodeskProjects}
              pending={pending}
              onSave={saveMapping}
              onSync={syncProject}
            />
          ))}
        </div>
      )}

      {syncResult && (
        <p className="text-sm text-success mt-4">
          Sync complete — {syncResult.created} created, {syncResult.updated} updated
          {syncResult.skipped > 0 ? `, ${syncResult.skipped} skipped` : ""}.
        </p>
      )}

      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function ProjectMappingRow({
  project,
  autodeskProjects,
  pending,
  onSave,
  onSync,
}: {
  project: ProjectRow;
  autodeskProjects: AutodeskProjectOption[];
  pending: boolean;
  onSave: (projectId: string, autodeskProjectId: string) => void;
  onSync: (projectId: string) => void;
}) {
  const [selected, setSelected] = useState(project.autodeskProjectId ?? "");

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
        {autodeskProjects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.attributes.name}
          </option>
        ))}
      </select>
      <Button variant="secondary" onClick={() => onSync(project.id)} disabled={pending || !selected}>
        Sync now
      </Button>
    </div>
  );
}
