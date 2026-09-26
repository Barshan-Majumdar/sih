import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function MembersRedirectPage() {
  await redirectToActiveProjectTool("members");
}
