import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function BaselinesRedirectPage() {
  await redirectToActiveProjectTool("baselines");
}
