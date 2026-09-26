import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function WeeklyPlanRedirectPage() {
  await redirectToActiveProjectTool("weekly-plan");
}
