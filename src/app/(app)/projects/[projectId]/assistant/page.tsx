import { redirect } from "next/navigation";

export default async function LegacyAssistantPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  redirect(`/agent/${projectId}`);
}
