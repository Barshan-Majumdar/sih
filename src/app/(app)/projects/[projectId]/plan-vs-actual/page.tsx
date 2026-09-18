import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PlanVsActualView } from "@/components/PlanVsActualView";

interface PlanVsActualPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function PlanVsActualPage({ params }: PlanVsActualPageProps) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      tasks: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          progress: true,
          status: true,
        },
        orderBy: { sequenceOrder: "asc" },
      },
    },
  });

  if (!project) notFound();

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6">
      <PlanVsActualView
        projectId={project.id}
        projectName={project.name}
        tasks={project.tasks}
      />
    </div>
  );
}
