"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker in production.
 * In development, removes old service workers/caches so stale client bundles
 * cannot cause hydration mismatches after code changes.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      const reloadKey = "agira-dev-sw-cleaned";

      async function removeDevServiceWorkers() {
        const registrations = await navigator.serviceWorker.getRegistrations();
        const hadServiceWorker = registrations.length > 0 || !!navigator.serviceWorker.controller;

        await Promise.all(registrations.map((registration) => registration.unregister()));

        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((key) => key.startsWith("agira-"))
              .map((key) => caches.delete(key))
          );
        }

        if (hadServiceWorker && sessionStorage.getItem(reloadKey) !== "true") {
          sessionStorage.setItem(reloadKey, "true");
          window.location.reload();
        }
      }

      void removeDevServiceWorkers().catch(() => {
        // Dev cleanup should never block rendering.
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Registration failure just means no offline support; never break the app.
    });
  }, []);

  return null;
}
