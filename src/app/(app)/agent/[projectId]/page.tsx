import { AgentWorkspace } from "@/components/AgentWorkspace";

export const metadata = {
  title: "Agent Copilot | InfraTrack",
  description: "AI Construction Schedule & Intelligence Copilot",
};

export default async function AgentProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return <AgentWorkspace initialProjectId={projectId} />;
}
