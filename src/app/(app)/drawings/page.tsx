import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function DrawingsRedirectPage() {
  await redirectToActiveProjectTool("drawings");
}
