import type { NextConfig } from "next";

// Baseline security headers for every route. A strict Content-Security-Policy
// is intentionally omitted: Next.js relies on inline scripts for hydration, so
// a meaningful CSP needs per-request nonces — configure carefully for production
// before adding one in production.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // HSTS is a no-op over plain http (local dev) and enforced by browsers only
  // after an https response carries it — safe to send unconditionally.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  // unpdf dynamically loads its bundled serverless PDF.js runtime.
  serverExternalPackages: ["unpdf"],
  experimental: {
    // Assistant uploads allow 20 MB files; multipart framing needs a small buffer.
    proxyClientMaxBodySize: "21mb",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // PDFs are rendered by Agira's same-origin in-app viewer.
        // Keep cross-origin framing blocked while allowing that one surface.
        source: "/api/files/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
