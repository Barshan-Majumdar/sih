import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function ActivityRedirectPage() {
  await redirectToActiveProjectTool("activity");
}
