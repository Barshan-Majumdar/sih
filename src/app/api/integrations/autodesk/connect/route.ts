import { redirect } from "next/navigation";
import { startAutodeskConnect } from "@/app/actions/autodesk";

export async function GET() {
  await startAutodeskConnect();
  redirect("/integrations");
}
