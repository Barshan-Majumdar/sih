import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function PullPlanningRedirectPage() {
  await redirectToActiveProjectTool("pull-planning");
}
