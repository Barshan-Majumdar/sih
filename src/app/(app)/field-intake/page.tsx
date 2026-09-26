import { redirectToActiveProjectTool } from "@/lib/project-navigation";

export default async function FieldIntakeRedirectPage() {
  await redirectToActiveProjectTool("field-intake");
}
