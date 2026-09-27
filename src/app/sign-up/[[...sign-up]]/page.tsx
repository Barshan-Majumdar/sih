import { AuthShell } from "@/components/AuthShell";

export const metadata = {
  title: "Sign Up | InfraTrack",
  description: "Create your InfraTrack infrastructure project workspace.",
};

export default function SignUpPage() {
  return <AuthShell initialMode="sign-up" />;
}
