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
  title: "Agira - Construction Operations",
  description:
    "Agira runs the schedule, the field, and the project documents as one loop, where every AI change is cited, reviewed, and reversible.",
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
  themeColor: "#101720",
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
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeInitializer }} />
        </head>
        <body className="min-h-full flex flex-col bg-canvas text-ink">
          {children}
          <ServiceWorkerRegistrar />
        </body>
      </html>
    </ClerkProvider>
  );
}
