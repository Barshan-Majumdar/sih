import { NavBar } from "@/components/NavBar";
import { GlobalAssistant } from "@/components/GlobalAssistant";
import { ProjectRouteSubNav } from "@/components/ProjectSubNav";
import { DashboardPdfViewer } from "@/components/PdfViewer";
import { AppThemeProvider } from "@/components/AppThemeProvider";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell" data-app-theme="light" style={{ colorScheme: "light" }}>
      <AppThemeProvider>
        <a
          href="#main-content"
          className="fixed left-4 top-4 z-[100] -translate-y-24 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-canvas shadow-lg transition-transform focus:translate-y-0"
        >
          Skip to main content
        </a>
        <NavBar />
        <ProjectRouteSubNav />
        <main id="main-content" tabIndex={-1} className="app-main outline-none">{children}</main>
        <DashboardPdfViewer />
        <GlobalAssistant />
      </AppThemeProvider>
    </div>
  );
}
