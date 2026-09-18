import { redirect } from "next/navigation";
import { startProcoreConnect } from "@/app/actions/procore";

/** Starts the Procore OAuth flow (org owner + Pro plan required). */
export async function GET() {
  await startProcoreConnect();
  redirect("/integrations");
}
