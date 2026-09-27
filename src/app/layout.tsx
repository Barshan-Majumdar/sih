import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import "./globals.css";

/* Restore saved theme early to prevent flash of wrong theme or scrollbar */
const themeInitializer = `
try {
  var stored = localStorage.getItem("infratrack:theme") || localStorage.getItem("agira:theme");
  if (stored === "dark") {
    document.documentElement.dataset.appTheme = "dark";
    document.documentElement.style.colorScheme = "dark";
  } else {
    delete document.documentElement.dataset.appTheme;
    document.documentElement.style.colorScheme = "light";
  }
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://infratrack.app"),
  title: {
    default: "InfraTrack - Autonomous Construction Operations OS",
    template: "%s | InfraTrack",
  },
  description:
    "InfraTrack runs the schedule, the field, and the project documents as one cited, reviewed, and reversible control loop. Built for project managers, superintendents, and trade partners.",
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
  authors: [{ name: "InfraTrack Systems" }],
  creator: "InfraTrack",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "InfraTrack",
    title: "InfraTrack - Autonomous Construction Operations OS",
    description:
      "One control room for the schedule, the field, and the project documents. Every AI change is cited, reviewed, and reversible.",
  },
  twitter: {
    card: "summary_large_image",
    title: "InfraTrack - Construction Operations OS",
    description: "Every commitment, cited and reversible. Autonomous construction operations control.",
  },
  robots: {
    index: true,
    follow: true,
  },
  appleWebApp: {
    capable: true,
    title: "InfraTrack",
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
  name: "InfraTrack",
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
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      signInForceRedirectUrl="/dashboard"
      signUpForceRedirectUrl="/dashboard"
    >
      <html
        lang="en"
        className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head suppressHydrationWarning>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
