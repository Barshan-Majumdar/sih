import { NextResponse } from "next/server";
import { completeAutodeskOAuth } from "@/app/actions/autodesk";
import { observeApiRequest, reportException } from "@/lib/observability";

async function handleGet(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

  if (error) {
    return NextResponse.redirect(`${base}/integrations?autodesk_error=${encodeURIComponent(error)}`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${base}/integrations?autodesk_error=missing_code`);
  }

  try {
    await completeAutodeskOAuth(code, state);
    return NextResponse.redirect(`${base}/integrations?autodesk_connected=1`);
  } catch (err) {
    reportException(err, "integration.autodesk.oauth_failed");
    const message = err instanceof Error ? err.message : "Autodesk connection failed";
    return NextResponse.redirect(`${base}/integrations?autodesk_error=${encodeURIComponent(message)}`);
  }
}

export async function GET(request: Request) {
  return observeApiRequest(request, "integration.autodesk.callback", () => handleGet(request));
}
