"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { ErrorText } from "@/components/ui/ErrorText";
import { createOrganization } from "@/app/actions/organizations";

export function CreateOrganizationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("name", name);

    const result = await createOrganization(formData);

    if (!result.success) {
      setLoading(false);
      setError(result.error ?? "Could not create organization.");
      return;
    }

    setLoading(false);
    router.push("/projects");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="orgName">Company / Organization name</Label>
        <Input
          id="orgName"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Oil India Ltd / Project Unit"
        />
      </div>
      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creating…" : "Create organization"}
      </Button>
    </form>
  );
}
