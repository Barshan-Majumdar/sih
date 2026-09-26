import { requireActiveOrganization } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Card";
import { AppPageHeader } from "@/components/PageHeader";
import { Cpu, FileSearch, Sparkles, CheckCircle2, ShieldBan } from "lucide-react";

export default async function IntegrationsPage() {
  const { organizationId } = await requireActiveOrganization();
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });

  return (
    <div className="app-page app-page-narrow">
      <AppPageHeader
        eyebrow="Organization Architecture"
        title="Connected Engines & Integrations"
        description={`Active intelligence services powering real-time schedule linking for ${org.name}.`}
      />

      <div className="space-y-4">
        {/* Python NLP & Retrieval Service */}
        <Card className="p-6 transition-all hover:border-brand-accent/40 hover:shadow-[0_8px_20px_-4px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent shadow-[0_1px_2px_rgba(37,99,235,0.1)]">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h2 className="app-card-title text-base">Python Domain Brain & Hybrid Retrieval Service</h2>
                <p className="text-xs text-muted">FastAPI &middot; BM25 Lexical Search &middot; FAISS Dense Vector &middot; 8-Signal Reranker</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-success/10 px-2.5 py-1 text-xs font-semibold text-success border border-success/20">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" aria-hidden />
              Active (Port 8000)
            </span>
          </div>
          <p className="text-sm text-body leading-relaxed">
            Performs Reciprocal Rank Fusion (RRF) and 8-signal contextual reranking (WBS hierarchy, trade domain, keyword overlap, milestone priority, temporal proximity, and a -0.40 conflict penalty) to map noisy field notes to schedule WBS IDs.
          </p>
        </Card>

        {/* Self-Hosted OCR Worker */}
        <Card className="p-6 transition-all hover:border-brand-accent/40 hover:shadow-[0_8px_20px_-4px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-accent/10 text-brand-accent shadow-[0_1px_2px_rgba(37,99,235,0.1)]">
                <FileSearch className="h-5 w-5" />
              </div>
              <div>
                <h2 className="app-card-title text-base">Self-Hosted OCRmyPDF Engine</h2>
                <p className="text-xs text-muted">Docker Service &middot; Tesseract OCR &middot; Scanned Site Logs & Drawings</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-success/10 px-2.5 py-1 text-xs font-semibold text-success border border-success/20">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" aria-hidden />
              Active (Port 8010)
            </span>
          </div>
          <p className="text-sm text-body leading-relaxed">
            Extracts searchable text layers and progress entries from handwritten daily logs, scanned inspection sheets, and engineering PDFs without relying on third-party cloud OCR APIs.
          </p>
        </Card>

        {/* Google Gemini & OpenAI Providers */}
        <Card className="p-6 transition-all hover:border-brand-accent/40 hover:shadow-[0_8px_20px_-4px_rgba(15,23,42,0.06)]">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-badge-violet/10 text-badge-violet shadow-[0_1px_2px_rgba(139,92,246,0.1)]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="app-card-title text-base">Multi-Modal AI Extraction Copilot</h2>
                <p className="text-xs text-muted">Google Gemini 3.5 Flash-Lite (Priority #1) &middot; OpenAI GPT-4o-mini (Priority #2)</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-success/10 px-2.5 py-1 text-xs font-semibold text-success border border-success/20">
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
              Connected
            </span>
          </div>
          <p className="text-sm text-body leading-relaxed">
            Extracts normalized 1-to-N engineering observations from raw audio dictation and text progress logs with strict structured JSON schema enforcement.
          </p>
        </Card>

        {/* Commercial ERPs Note */}
        <Card className="p-6 opacity-85 border-dashed">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-soft text-muted">
                <ShieldBan className="h-5 w-5" />
              </div>
              <div>
                <h2 className="app-card-title text-base">Commercial ERPs (Procore / Autodesk ACC)</h2>
                <p className="text-xs text-muted">Proprietary Paid Ecosystems</p>
              </div>
            </div>
            <span className="shrink-0 rounded-pill bg-surface-soft border border-hairline px-2.5 py-0.5 text-xs font-medium text-muted">
              Decoupled
            </span>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            To ensure complete self-hosted independence and eliminate recurring vendor subscription costs for Smart India Hackathon Problem Statement 26122, paid commercial connectors have been decoupled in favor of our native, 100% self-hosted open-source engine.
          </p>
        </Card>
      </div>
    </div>
  );
}
