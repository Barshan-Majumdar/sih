import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isEmailConfigured } from "@/lib/email";
import { NotificationToggle } from "@/components/NotificationToggle";
import { Card } from "@/components/ui/Card";
import { AppPageHeader } from "@/components/PageHeader";

export default async function SettingsPage() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { name: true, email: true, emailNotificationsEnabled: true },
  });

  return (
    <div className="app-page app-page-narrow">
      <AppPageHeader
        eyebrow="Account"
        title="Settings"
        description={`${dbUser.name} · ${dbUser.email}`}
      />

      <Card className="p-6">
        <h2 className="app-section-title mb-4">Notifications</h2>
        <NotificationToggle initialEnabled={dbUser.emailNotificationsEnabled} />
        {!isEmailConfigured() && (
          <p className="text-xs text-muted-soft mt-4 border-t border-hairline-soft pt-4">
            Email sending isn&apos;t configured on this server yet (no <code>RESEND_API_KEY</code>) — notifications
            are currently skipped regardless of this setting.
          </p>
        )}
      </Card>
    </div>
  );
}
