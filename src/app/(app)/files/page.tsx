import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function FilesRedirectPage() {
  await redirectToActiveProjectTool("files");
}
