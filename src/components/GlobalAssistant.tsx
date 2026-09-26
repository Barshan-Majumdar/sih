"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function GlobalAssistant() {
  const router = useRouter();

  useEffect(() => {
    const handleToggle = (event: Event) => {
      const detail = (event as CustomEvent<{ open?: boolean }>).detail;
      if (detail?.open !== false) {
        router.push("/agent");
      }
    };

    const handleOpenProjectFile = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId?: string; fileName?: string }>).detail;
      if (detail?.projectId && detail?.fileName) {
        router.push(`/agent/${detail.projectId}?file=${encodeURIComponent(detail.fileName)}`);
      } else if (detail?.projectId) {
        router.push(`/agent/${detail.projectId}`);
      } else {
        router.push("/agent");
      }
    };

    window.addEventListener("infratrack:toggle-assistant", handleToggle);
    window.addEventListener("agira:toggle-assistant", handleToggle);
    window.addEventListener("infratrack:open-project-file-agent", handleOpenProjectFile);
    window.addEventListener("agira:open-project-file-agent", handleOpenProjectFile);
    window.addEventListener("infratrack:ask-project-file", handleOpenProjectFile);
    window.addEventListener("agira:ask-project-file", handleOpenProjectFile);

    return () => {
      window.removeEventListener("infratrack:toggle-assistant", handleToggle);
      window.removeEventListener("agira:toggle-assistant", handleToggle);
      window.removeEventListener("infratrack:open-project-file-agent", handleOpenProjectFile);
      window.removeEventListener("agira:open-project-file-agent", handleOpenProjectFile);
      window.removeEventListener("infratrack:ask-project-file", handleOpenProjectFile);
      window.removeEventListener("agira:ask-project-file", handleOpenProjectFile);
    };
  }, [router]);

  return null;
}
