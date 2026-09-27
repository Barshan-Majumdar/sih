import { AuthShell } from "@/components/AuthShell";

export const metadata = {
  title: "Sign In | InfraTrack",
  description: "Sign in to your InfraTrack infrastructure project workspace.",
};

export default function SignInPage() {
  return <AuthShell initialMode="sign-in" />;
}
