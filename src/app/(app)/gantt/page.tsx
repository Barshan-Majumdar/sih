import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function GanttRedirectPage() {
  await redirectToActiveProjectTool("gantt");
}
