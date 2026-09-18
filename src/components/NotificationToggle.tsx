"use client";

import { useState, useTransition } from "react";
import { setEmailNotifications } from "@/app/actions/settings";
import { ErrorText } from "@/components/ui/ErrorText";

export function NotificationToggle({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    setError(null);
    startTransition(async () => {
      const result = await setEmailNotifications({ enabled: next });
      if (!result.success) {
        setEnabled(!next); // revert on failure
        setError(result.error);
      }
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-ink">Email notifications</p>
          <p className="text-xs text-muted mt-0.5">
            Task assignments, roadblocks assigned to you, RFI answers, and schedule impact decisions.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={handleToggle}
          disabled={pending}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-pill transition-colors disabled:opacity-50 ${
            enabled ? "bg-primary" : "bg-surface-strong"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-canvas shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
