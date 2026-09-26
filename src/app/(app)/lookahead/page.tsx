import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function LookaheadRedirectPage() {
  await redirectToActiveProjectTool("lookahead");
}
