import Link from "next/link";
import { CreateOrganizationForm } from "@/components/CreateOrganizationForm";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export default async function NewOrganizationPage() {
  const user = await requireUser();
  const hasExistingOrg = (await prisma.member.count({ where: { userId: user.id } })) > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-soft px-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="font-display text-2xl mb-1">
          {hasExistingOrg ? "Create a new organization" : "Create your organization"}
        </h1>
        <p className="text-sm text-muted mb-6">
          Projects live inside an organization so your team can collaborate on them.
        </p>
        <CreateOrganizationForm />
        {hasExistingOrg && (
          <Link
            href="/projects"
            className="block text-center text-sm text-muted hover:underline mt-4"
          >
            Cancel
          </Link>
        )}
      </Card>
    </div>
  );
}
