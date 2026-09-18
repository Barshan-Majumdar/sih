import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { logger, reportException } from "@/lib/observability";

/**
 * Email notifications over Gmail SMTP, authenticated with a Google app
 * password. Fire-and-forget by design: a failed or unconfigured email must
 * never break the mutation it announces (same philosophy as
 * lib/activity-log.ts).
 *
 * Without GOOGLE_USER and GOOGLE_AUTH_APP_PASSWORD, sends are skipped (and
 * logged in dev) so the whole feature degrades gracefully until both are set.
 *
 * Gmail applies per-account daily send limits and is appropriate for internal
 * and low-volume notification traffic, not bulk delivery.
 */

export function isEmailConfigured(): boolean {
  return !!(env.GOOGLE_USER && env.GOOGLE_AUTH_APP_PASSWORD);
}

/** Built lazily so importing this module never opens a connection. */
let transporter: Transporter | null = null;
function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user: env.GOOGLE_USER!, pass: env.GOOGLE_AUTH_APP_PASSWORD! },
    });
  }
  return transporter;
}

/** Falls back to the authenticated mailbox, which Gmail requires anyway. */
function senderAddress(): string {
  return env.EMAIL_FROM?.trim() ? env.EMAIL_FROM : `Agira <${env.GOOGLE_USER}>`;
}

/** Shared shell so every notification renders with consistent branding. */
export function renderEmailHtml(heading: string, bodyLines: string[], ctaUrl?: string, ctaLabel?: string): string {
  const paragraphs = bodyLines
    .map((line) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#384654;">${line}</p>`)
    .join("");
  const cta = ctaUrl
    ? `<a href="${ctaUrl}" style="display:inline-block;margin-top:8px;padding:10px 20px;background:#101720;color:#ffffff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">${ctaLabel ?? "Open Agira"}</a>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f8f9fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #dde3ea;border-radius:12px;padding:32px;">
    <p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#101720;">Agira</p>
    <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#101720;letter-spacing:-0.02em;">${heading}</h1>
    ${paragraphs}
    ${cta}
    <p style="margin:24px 0 0;font-size:12px;color:#898989;">You can turn these notifications off in Settings.</p>
  </div>
</body></html>`;
}

export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<void> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "development") {
      logger.info("email.skipped", { reason: "not-configured" });
    }
    return;
  }

  try {
    const info = await getTransporter().sendMail({
      from: senderAddress(),
      to: params.to,
      subject: params.subject,
      html: params.html,
    });
    logger.info("email.delivery.completed", { accepted: info.accepted?.length ?? 0 });
  } catch (error) {
    reportException(error, "email.delivery.failed");
    // Never propagate email failures into the calling mutation.
  }
}
