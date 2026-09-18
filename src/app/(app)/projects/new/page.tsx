import { requireActiveOrganization } from "@/lib/session";
import { ProjectForm } from "@/components/ProjectForm";
import { Card } from "@/components/ui/Card";
import { AppPageHeader } from "@/components/PageHeader";

export default async function NewProjectPage() {
  const { organizationId } = await requireActiveOrganization();

  return (
    <div className="app-page app-page-narrow">
      <AppPageHeader
        eyebrow="Project setup"
        title="New project"
        description="Define the delivery window and create a workspace. You will be assigned as Project Manager."
      />
      <Card className="p-6">
        <ProjectForm organizationId={organizationId} />
      </Card>
    </div>
  );
}
