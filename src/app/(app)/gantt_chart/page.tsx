import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function GanttChartRedirectPage() {
  await redirectToActiveProjectTool("gantt");
}
