import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function RFIsRedirectPage() {
  await redirectToActiveProjectTool("rfis");
}
