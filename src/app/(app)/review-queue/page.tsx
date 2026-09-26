import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function ReviewQueueRedirectPage() {
  await redirectToActiveProjectTool("review-queue");
}
