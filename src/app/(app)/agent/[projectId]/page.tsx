import { redirect } from "next/navigation";

export const metadata = {
  title: "Agent Copilot | InfraTrack",
  description: "AI Construction Schedule & Intelligence Copilot",
};

export default function AgentProjectPage() {
  redirect("/agent");
}

