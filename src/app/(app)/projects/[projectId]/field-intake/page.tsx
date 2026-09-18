import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { FieldIntakePanel } from "@/components/FieldIntakePanel";

interface FieldIntakePageProps {
  params: Promise<{ projectId: string }>;
}

export default async function FieldIntakePage({ params }: FieldIntakePageProps) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) notFound();

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6">
      <FieldIntakePanel projectId={project.id} />
    </div>
  );
}
