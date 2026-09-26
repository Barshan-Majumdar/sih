import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function ImpactsRedirectPage() {
  await redirectToActiveProjectTool("impacts");
}
