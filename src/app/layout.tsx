import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

/* Clear any legacy html-level theme so marketing pages never inherit app dark mode. */
const themeInitializer = `
try {
  delete document.documentElement.dataset.appTheme;
  document.documentElement.style.colorScheme = "light";
} catch (_) {}
`;

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://agira.app"),
  title: {
    default: "Agira - Autonomous Construction Operations OS",
    template: "%s | Agira",
  },
  description:
    "Agira runs the schedule, the field, and the project documents as one cited, reviewed, and reversible control loop. Built for project managers, superintendents, and trade partners.",
  keywords: [
    "construction operations",
    "master schedule",
    "last planner system",
    "lookahead planning",
    "critical path method",
    "pull planning",
    "construction AI",
    "field tracking",
  ],
  authors: [{ name: "Agira Systems" }],
  creator: "Agira",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Agira",
    title: "Agira - Autonomous Construction Operations OS",
    description:
      "One control room for the schedule, the field, and the project documents. Every AI change is cited, reviewed, and reversible.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Agira - Construction Operations OS",
    description: "Every commitment, cited and reversible. Autonomous construction operations control.",
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: "Agira",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Agira",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Autonomous construction operations platform linking CPM schedules, field logs, and engineering documents in a single cited control loop.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

import { ClerkProvider } from "@clerk/nextjs";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
        style={{ colorScheme: "light" }}
        suppressHydrationWarning
      >
        <head suppressHydrationWarning>
          <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeInitializer }} />
          <script
            type="application/ld+json"
            suppressHydrationWarning
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />
        </head>
        <body className="min-h-full flex flex-col bg-canvas text-ink">
          {children}
          <ServiceWorkerRegistrar />
        </body>
      </html>
    </ClerkProvider>
  );
}
