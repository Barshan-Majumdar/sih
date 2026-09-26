import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function TasksRedirectPage() {
  await redirectToActiveProjectTool("tasks");
}
