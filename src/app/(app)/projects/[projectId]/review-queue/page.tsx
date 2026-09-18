import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectReviewQueue } from "@/app/actions/field-progress";
import { ReviewQueueWorkspace } from "@/components/ReviewQueueWorkspace";

interface ReviewQueuePageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ReviewQueuePage({ params }: ReviewQueuePageProps) {
  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true },
  });

  if (!project) notFound();

  const queueData = await getProjectReviewQueue(projectId);

  return (
    <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6">
      <ReviewQueueWorkspace
        projectId={project.id}
        autoLinked={queueData.autoLinked as any}
        pendingReview={queueData.pendingReview as any}
        unmatched={queueData.unmatched as any}
      />
    </div>
  );
}
