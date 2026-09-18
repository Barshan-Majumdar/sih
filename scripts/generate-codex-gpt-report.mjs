import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync } from "fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "../docs");
mkdirSync(outDir, { recursive: true });

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Agira: AI Development Report</title>
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      margin: 0;
      padding: 32px;
      color: #101828;
      line-height: 1.45;
    }
    h1, h2, h3 { color: #0f172a; margin-bottom: 6px; }
    h1 { font-size: 30px; margin-bottom: 8px; }
    h2 { margin-top: 28px; font-size: 20px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    h3 { margin-top: 20px; font-size: 16px; }
    p { font-size: 12px; }
    ul, ol { font-size: 12px; }
    .meta { color: #475569; margin-top: 4px; font-size: 12px; }
    .section { margin-top: 16px; }
    .callout {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #2563eb;
      padding: 10px 12px;
      margin: 10px 0;
      font-size: 12px;
      page-break-inside: avoid;
    }
    .small { font-size: 11px; color: #475569; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      margin-top: 8px;
    }
    th, td {
      border: 1px solid #d4dbe7;
      padding: 8px;
      text-align: left;
      vertical-align: top;
    }
    th { background: #f8fafc; }
    .diagram {
      margin: 16px 0;
      page-break-inside: avoid;
    }
    .mermaid { min-height: 180px; }
    .footer {
      margin-top: 18px;
      color: #64748b;
      font-size: 10px;
      border-top: 1px solid #e2e8f0;
      padding-top: 8px;
    }
  </style>
</head>
<body>
  <h1>Agira — How I Built the Project with Codex and GPT-5.6</h1>

  <h2>Executive Summary</h2>
  <p>
    Agira is a construction scheduling and project-control platform that combines planning views, project documents, and AI assistance in a single workspace. I used two AI partners in the build:
    <strong>Codex</strong> for implementation-heavy work and <strong>GPT-5.6</strong> for architecture framing, debugging strategy, and design feedback.
    The core safety model is <em>agent proposes, human approves</em>, never silent write.
  </p>

  <div class="callout">
    <strong>Key principle:</strong> AI accelerates analysis, but no change is applied without explicit user approval, permission verification, and audit logging.
  </div>

  <h2>Major Features Built with this Workflow</h2>
  <ol>
    <li><strong>AI Agent workspace with live project context</strong> (dashboard-integrated chat, message history, timed responses, and file-aware prompts).</li>
    <li><strong>Proposal-first action engine</strong> for tasks, commitments, roadblocks, RFIs, submittals, schedule impacts, and baselines.</li>
    <li><strong>Explicit confirmation flow</strong> for every mutating action, with status transitions and one-time apply behavior.</li>
    <li><strong>Permission + stale-data checks</strong> at propose and confirm time to prevent accidental or invalid updates.</li>
    <li><strong>Document intelligence layer</strong> with searchable PDF extraction, optional OCR, and citation references in assistant responses.</li>
    <li><strong>In-app PDF preview and page navigation</strong> for cited evidence.</li>
    <li><strong>Project activity log</strong> with proposal outcomes and change traceability.</li>
    <li><strong>Authentication + onboarding + role controls</strong> for org/project scoped operations.</li>
    <li><strong>Production hardening</strong> for Prisma access, async flows, and environment configuration for Vercel, Neon, and Supabase.</li>
  </ol>

  <h2>How I Used Codex</h2>
  <p>
    Codex was my primary implementation agent. Its best fit was in writing, wiring, and validating concrete app surfaces where speed and consistency matter most:
  </p>
  <ul>
    <li>Built and refined multi-file modules for assistant tools and action handlers.</li>
    <li>Implemented proposal-to-confirm pathways and transactional write safety.</li>
    <li>Added citation-aware UI paths for document-linked responses.</li>
    <li>Shaped frontend flows, chat panels, and proposal cards under real UX constraints.</li>
    <li>Helped with bug triage for runtime/render mismatches and edge cases in scheduling and permissions.</li>
    <li>Accelerated cleanup passes for repeated UI logic and accessibility or performance refinements.</li>
  </ul>

  <h2>How GPT-5.6 Helped</h2>
  <p>
    GPT-5.6 was used in planning and review loops to keep the build on a coherent product path:
  </p>
  <ul>
    <li>Feature decomposition from roadmap and prioritization sequencing.</li>
    <li>Workflow decisions for where AI should be read-only, propose-only, or blocked.</li>
    <li>Technical design reasoning for permission boundaries, stale-snapshot handling, and error recovery.</li>
    <li>Prompt and UX review for proposal quality, explanation clarity, and judge-facing narrative.</li>
  </ul>

  <div class="callout">
    <strong>Combined statement:</strong> Codex was my primary implementation agent for this build, driving the agent tools, proposal/confirm handlers, and permission hardening; GPT-5.6 powered those sessions and also handled planning and debugging-strategy turns.
  </div>

  <h2>System Design (Technical Diagram 1)</h2>
  <div class="diagram">
    <div class="mermaid">
      flowchart LR
        U["User / Project Team"] -->|"Ask / Action Request"| UI["Agira Frontend<br/>(Next.js App Router)"]
        UI -->|"Messages + context"| ASSIST["Assistant Router"]
        ASSIST --> LLM["OpenRouter-compatible LLM<br/>(OpenAI-compatible endpoint)"]
        ASSIST --> TOOL["Tooling Layer<br/>(project, schedule, tasks, files)"]
        TOOL --> DB[(Prisma + PostgreSQL)]
        TOOL --> FILES[("Supabase/S3 Storage")]
        ASSIST -->|"Proposal"| UI
        UI --> CONFIRM["User Confirmation"]
        CONFIRM --> EXEC["Server Action Executor"]
        EXEC --> AUDIT[("Activity Log + Audit Tables")]
        EXEC --> DB
    </div>
  </div>

  <h2>System Design (Technical Diagram 2: Action Safety)</h2>
  <div class="diagram">
    <div class="mermaid">
      sequenceDiagram
        autonumber
        participant A as User
        participant UI as Agent Chat
        participant B as Planner/Tools
        participant P as Permission Service
        participant S as State Store (Prisma)
        participant L as Activity Log

        A->>UI: Ask for change
        UI->>B: Build structured proposal
        B->>S: Read current records + build diffs
        B->>UI: Proposal card (impact + evidence)
        A->>UI: Confirm
        UI->>P: Recheck role + action rights
        UI->>S: Snapshot + stale data check + transaction
        S-->>UI: Persist changes
        UI->>L: Write audit trail
        UI->>A: Success + updated links
    </div>
  </div>

  <h2>Build Steps (Chronological)</h2>
  <table>
    <tr><th>Phase</th><th>What I Did</th></tr>
    <tr>
      <td>1. Product foundation</td>
      <td>Set up core domain: projects, schedules, commitments, tasks, RFIs, roadblocks, and role-based access.</td>
    </tr>
    <tr>
      <td>2. AI integration</td>
      <td>Connected model provider (OpenRouter-compatible routing), tool interfaces, and chat rendering with markdown and execution states.</td>
    </tr>
    <tr>
      <td>3. Safety model</td>
      <td>Implemented proposal-only write architecture, explicit confirmation gate, and transaction-based confirmation handler.</td>
    </tr>
    <tr>
      <td>4. Document intelligence</td>
      <td>Added upload, extraction, OCR path, and evidence references for source-backed answer display.</td>
    </tr>
    <tr>
      <td>5. UI/UX refinement</td>
      <td>Unified dashboard + chat, polishing layouts, action cards, attachments, and status markers.</td>
    </tr>
    <tr>
      <td>6. Hardening</td>
      <td>Added observability, validation, and production deployment reliability.</td>
    </tr>
  </table>

  <h2>Challenges and Fixes</h2>
  <ul>
    <li>Hydration mismatch and UI state drift were fixed by narrowing server/client branching and stabilizing chat rendering conditions.</li>
    <li>Proposal edge conditions (null payloads and missing fields) were fixed with defensive typing and schema fallback behavior.</li>
    <li>Async consistency across sessions was improved with revalidation and snapshot checks before confirm to prevent stale writes.</li>
    <li>Environment drift (model, storage, OCR) was handled through separate docs, guarded defaults, and deployment checks.</li>
  </ul>

  <h2>Result</h2>
  <p>
    The final product is not a demo assistant bolted onto a schedule page. It is a real operational layer where users can ask in context, receive evidence-backed responses, stage a proposed change, and apply it only after approval.
  </p>

  <h2>Conclusion</h2>
  <p>
    This report captures how AI accelerated the build without reducing accountability. The practical gain came from combining Codex for rapid implementation with GPT-5.6 for planning and quality decisions, while always enforcing human-in-the-loop governance on critical project control operations.
  </p>

  <div class="footer">
    This document is intended as a solo project report for submission. It outlines process, AI-assisted development, and safety-first product implementation.
  </div>

  <script>
    mermaid.initialize({ startOnLoad: false, theme: "default", securityLevel: "loose" });
    window.addEventListener('load', async () => {
      await mermaid.run({ nodes: document.querySelectorAll('.mermaid') });
    });
  </script>
</body>
</html>`;

const htmlPath = resolve(outDir, "agira-codex-gpt5.6-development-report.html");
const pdfPath = resolve(outDir, "agira-codex-gpt5.6-development-report.pdf");

writeFileSync(htmlPath, html, "utf8");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
await page.goto(`file://${htmlPath.replace(/\\/g, '/')}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.pdf({
  path: pdfPath,
  format: 'A4',
  printBackground: true,
  margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
});
await browser.close();

console.log(`Generated ${pdfPath}`);
