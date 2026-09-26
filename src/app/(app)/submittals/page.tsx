import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function SubmittalsRedirectPage() {
  await redirectToActiveProjectTool("submittals");
}
