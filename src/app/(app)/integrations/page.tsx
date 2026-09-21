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

      <div className="space-y-6">
        {/* Python NLP & Retrieval Service */}
        <Card className="p-6 border-primary/20 bg-primary/5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h2 className="app-card-title text-base">Python Domain Brain & Hybrid Retrieval Service</h2>
                <p className="text-xs text-muted-foreground">FastAPI &middot; BM25 Lexical Search &middot; FAISS Dense Vector &middot; 8-Signal Reranker</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3" />
              Active (Port 8000)
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Performs Reciprocal Rank Fusion (RRF) and 8-signal contextual reranking (WBS hierarchy, trade domain, keyword overlap, milestone priority, temporal proximity, and a -0.40 conflict penalty) to map noisy field notes to schedule WBS IDs.
          </p>
        </Card>

        {/* Self-Hosted OCR Worker */}
        <Card className="p-6 border-blue-500/20 bg-blue-500/5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                <FileSearch className="h-5 w-5" />
              </div>
              <div>
                <h2 className="app-card-title text-base">Self-Hosted OCRmyPDF Engine</h2>
                <p className="text-xs text-muted-foreground">Docker Service &middot; Tesseract OCR &middot; Scanned Site Logs & Drawings</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3" />
              Active (Port 8010)
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Extracts searchable text layers and progress entries from handwritten daily logs, scanned inspection sheets, and engineering PDFs without relying on third-party cloud OCR APIs.
          </p>
        </Card>

        {/* Google Gemini & OpenAI Providers */}
        <Card className="p-6 border-purple-500/20 bg-purple-500/5">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="app-card-title text-base">Multi-Modal AI Extraction Copilot</h2>
                <p className="text-xs text-muted-foreground">Google Gemini 3.5 Flash-Lite (Priority #1) &middot; OpenAI GPT-4o-mini (Priority #2)</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="h-3 w-3" />
              Connected
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Extracts normalized 1-to-N engineering observations from raw audio dictation and text progress logs with strict structured JSON schema enforcement.
          </p>
        </Card>

        {/* Commercial ERPs Note */}
        <Card className="p-6 opacity-75 border-border">
          <div className="flex items-start justify-between gap-4 mb-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <ShieldBan className="h-5 w-5" />
              </div>
              <div>
                <h2 className="app-card-title text-base">Commercial ERPs (Procore / Autodesk ACC)</h2>
                <p className="text-xs text-muted-foreground">Proprietary Paid Ecosystems</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Decoupled
            </span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            To ensure complete self-hosted independence and eliminate recurring vendor subscription costs for Smart India Hackathon Problem Statement 26122, paid commercial connectors have been decoupled in favor of our native, 100% self-hosted open-source engine.
          </p>
        </Card>
      </div>
    </div>
  );
}
