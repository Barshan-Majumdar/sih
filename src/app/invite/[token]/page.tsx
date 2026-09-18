import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { Card } from "@/components/ui/Card";
import { AcceptInviteButton } from "@/components/AcceptInviteButton";
import { PROJECT_ROLE_LABELS } from "@/lib/utils";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await prisma.projectInvite.findUnique({
    where: { token },
    include: { project: { include: { organization: true } } },
  });

  const session = await getCurrentSession();

  const callbackURL = `/invite/${token}`;

  if (!invite) {
    return (
      <InviteShell>
        <h1 className="font-display text-xl mb-2">Invite not found</h1>
        <p className="text-sm text-muted">This invite link is invalid.</p>
      </InviteShell>
    );
  }

  if (invite.usedAt) {
    return (
      <InviteShell>
        <h1 className="font-display text-xl mb-2">Invite already used</h1>
        <p className="text-sm text-muted">
          This invite link has already been used. Ask a Project Manager for a new one.
        </p>
      </InviteShell>
    );
  }

  if (invite.expiresAt < new Date()) {
    return (
      <InviteShell>
        <h1 className="font-display text-xl mb-2">Invite expired</h1>
        <p className="text-sm text-muted">
          This invite link has expired. Ask a Project Manager for a new one.
        </p>
      </InviteShell>
    );
  }

  return (
    <InviteShell>
      <h1 className="font-display text-xl mb-2">You&apos;ve been invited</h1>
      <p className="text-sm text-body mb-1">
        Join <span className="font-semibold">{invite.project.name}</span> at{" "}
        <span className="font-semibold">{invite.project.organization.name}</span>
      </p>
      <p className="text-sm text-muted mb-6">
        Role: <span className="font-medium text-ink">{PROJECT_ROLE_LABELS[invite.role]}</span>
      </p>

      {session?.user ? (
        <AcceptInviteButton token={token} projectId={invite.projectId} />
      ) : (
        <div className="space-y-3">
          <Link
            href={`/sign-up?callbackURL=${encodeURIComponent(callbackURL)}`}
            className="flex h-10 w-full items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-active transition-colors"
          >
            Sign up to join
          </Link>
          <Link
            href={`/sign-in?callbackURL=${encodeURIComponent(callbackURL)}`}
            className="block text-center text-sm text-muted hover:underline"
          >
            Already have an account? Sign in
          </Link>
        </div>
      )}
    </InviteShell>
  );
}

function InviteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-soft px-4">
      <Card className="w-full max-w-sm p-8">{children}</Card>
    </div>
  );
}
