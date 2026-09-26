import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function PlanVsActualRedirectPage() {
  await redirectToActiveProjectTool("plan-vs-actual");
}
