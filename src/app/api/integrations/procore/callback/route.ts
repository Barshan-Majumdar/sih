import { NextResponse } from "next/server";
import { completeProcoreOAuth } from "@/app/actions/procore";
import { env } from "@/lib/env";
import { observeApiRequest, reportException } from "@/lib/observability";

async function handleGet(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  if (error) {
    return NextResponse.redirect(`${base}/integrations?error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${base}/integrations?error=missing_code`);
  }

  try {
    await completeProcoreOAuth(code, state);
    return NextResponse.redirect(`${base}/integrations?connected=1`);
  } catch (err) {
    reportException(err, "integration.procore.oauth_failed");
    const message = err instanceof Error ? err.message : "Procore connection failed";
    return NextResponse.redirect(`${base}/integrations?error=${encodeURIComponent(message)}`);
  }
}

export async function GET(request: Request) {
  return observeApiRequest(request, "integration.procore.callback", () => handleGet(request));
}
