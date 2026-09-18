"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "#f5f6f8", color: "#171717", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ maxWidth: 440, textAlign: "center" }}>
            <h1 style={{ margin: "0 0 12px", fontSize: 28 }}>Something went wrong</h1>
            <p style={{ margin: "0 0 24px", color: "#667085", lineHeight: 1.6 }}>
              Try this page again, or return to it in a moment.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ border: 0, borderRadius: 8, background: "#171717", color: "white", padding: "11px 18px", fontWeight: 600, cursor: "pointer" }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
