import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function RoadblocksRedirectPage() {
  await redirectToActiveProjectTool("roadblocks");
}
