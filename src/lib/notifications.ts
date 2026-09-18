import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { sendEmail, renderEmailHtml } from "@/lib/email";

/**
 * Sends a notification email to a user, respecting their preference and
 * skipping self-notifications (you don't need an email about your own edit).
 * Fire-and-forget: never throws.
 */
export async function notifyUser(params: {
  userId: string;
  actorUserId?: string | null;
  subject: string;
  heading: string;
  bodyLines: string[];
  /** App path for the CTA button, e.g. `/projects/abc/roadblocks`. */
  path?: string;
}): Promise<void> {
  try {
    if (params.actorUserId && params.actorUserId === params.userId) return;

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { email: true, emailNotificationsEnabled: true },
    });
    if (!user || !user.emailNotificationsEnabled) return;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const ctaUrl = params.path ? `${appUrl.replace(/\/$/, "")}${params.path}` : undefined;
    await sendEmail({
      to: user.email,
      subject: params.subject,
      html: renderEmailHtml(params.heading, params.bodyLines, ctaUrl),
    });
  } catch {
    // Notifications must never break the mutation that triggered them.
  }
}
