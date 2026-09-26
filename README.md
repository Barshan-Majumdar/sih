# InfraTrack PM (SIH Problem Statement 26122)
### Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management: Real-Time Actual Progress Tracking
**Sponsored by:** Oil India Limited (OIL)  
**Location:** `d:/SIH26/sih2`

---

## 1. System Overview

**InfraTrack PM** is an enterprise-grade infrastructure project controls and progress tracking platform built specifically for Smart India Hackathon Problem Statement 26122. It bridges the critical divide between raw, multi-modal jobsite progress updates (freeform text daily progress reports, voice dictations, scanned site PDFs) and the engineering master schedule (WBS/CPM).

```
   Jobsite Updates (Voice, Text DPRs, Scanned PDFs)
                           │
                           ▼
          [ Multi-Modal Extraction Engine ]
             (Gemini / OpenAI Fallback)
                           │
                           ▼
          [ Hybrid Retrieval & Reranker Microservice ]
    (BM25 + FAISS Dense Embeddings + RRF + 8-Signal Reranker)
                           │
                           ▼
          [ Human-in-the-Loop Review Queue ]
     (Auto-Link ≥0.70 | Review 0.45–0.70 | Unmatched <0.45)
                           │
                           ▼
          [ Duration-Weighted WBS Progress Rollup ]
         Weight_i = max(1, EndDate_i - StartDate_i)
                           │
                           ▼
      [ CPM Gantt | Lookaheads | Weekly PPC | AI Agent ]
```

### Core Architectural Pillars
1. **Multi-Modal Field Intake:** Natural language voice dictation, freeform text DPRs, and scanned document OCR with auto-deskew and PDF text layer injection.
2. **AI Entity & Observation Extraction:** Google Gemini (`gemini-3.5-flash-lite` Priority #1) and OpenAI (`gpt-4o-mini` Priority #2) parsing unstructured logs into normalized engineering observations.
3. **Domain Brain & Hybrid Retrieval Microservice (Port 8000):** Python FastAPI service integrating:
   - **BM25 Lexical Search** (exact acronyms, code matches, chainage markers)
   - **FAISS Dense Vector Embeddings** (semantic task descriptions)
   - **Reciprocal Rank Fusion (RRF)** ($k=60$)
   - **8-Signal Contextual Reranker** (WBS proximity, temporal proximity, trade match, keyword overlap, milestone boost, contradiction penalty)
   - **Terminology Normalization Engine** (100+ domain terms and Indian infrastructure acronyms)
4. **Human-in-the-Loop Review Queue:** 3-tier confidence classification with explainable scoring breakdown and 1-click single/batch approval.
5. **Duration-Weighted WBS Progress Rollup:** $Weight_i = \max(1, EndDate_i - StartDate_i)$ ensuring critical civil engineering activities dominate progress calculations over short administrative tasks.
6. **Unified Project Controls Suite:** Interactive CPM Gantt chart, rolling lookahead windows, Last Planner weekly work plans with Percent Plan Complete (PPC), roadblock logs, schedule impact requests, RFIs, submittals, and drawing version control.
7. **Dedicated Full-Screen AI Agent Workspace (`/agent`):** Split-view conversational copilot with built-in PDF viewer, live citation links, voice dictation, and permission-checked mutation proposals.

---

## 2. Technology Stack

| Layer | Technologies |
| --- | --- |
| **Web Frontend & API** | Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4, Lucide Icons, GSAP |
| **Design & Interactivity** | Responsive dark/light theme engine, React Bits TechText canvas watermark, glassmorphism UI |
| **Authentication & RBAC** | Clerk Auth (`@clerk/nextjs` Core 3) with pre-configured keys and role-based permissions |
| **Database & ORM** | PostgreSQL (Neon serverless pooler), Prisma ORM 6.19 |
| **Primary LLM** | **Google Gemini** (`gemini-3.5-flash-lite`) via Vercel AI SDK |
| **Secondary LLM** | **OpenAI** (`gpt-4o-mini`) fallback engine |
| **NLP & Retrieval Microservice** | Python 3.13, FastAPI, Uvicorn, Rank-BM25, FAISS, Pydantic, Pillow, OCRmyPDF |
| **PDF & Document Engine** | `pdfjs-dist` 6.1 (client-side rendering) + `unpdf` 1.6 (serverless metadata extraction) |

---

## 3. Quick Start & Execution

### A. Environment Configuration
Create a `.env` file in the project root (refer to `.env.example` for all optional flags):
```bash
cp .env.example .env
```

Key environment variables template:
```bash
# Database (PostgreSQL / Neon Pooler)
DATABASE_URL="postgresql://username:password@ep-sample-pooler.region.aws.neon.tech/neondb?sslmode=require"

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace_with_clerk_publishable_key"
CLERK_SECRET_KEY="sk_test_replace_with_clerk_secret_key"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Microservices & AI LLM Providers
RETRIEVAL_SERVICE_URL="http://localhost:8000"
GEMINI_API_KEY="replace_with_google_gemini_api_key"
OPENAI_API_KEY="replace_with_openai_api_key"
```

### B. Launching the Python Retrieval Microservice
Open a terminal and run the microservice using the virtual environment:
```powershell
npm run retrieval:dev
```
*Direct python execution:*
```powershell
cd d:\SIH26\sih2\retrieval
.\.venv\Scripts\python -m uvicorn src.server:app --port 8000 --reload
```
- Health Check: [http://localhost:8000/health](http://localhost:8000/health)
- Interactive Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### C. Launching the Next.js Web Application
In a second terminal:
```powershell
npm run dev
```
Open your browser to: [http://localhost:3000](http://localhost:3000)

### D. Database Migrations & Seeding
To re-seed sample projects, schedules, and test users:
```powershell
npm run db:seed
```

### E. Running Test Suites
- **Unit & Integration Suite (187 Vitest tests across 26 suites):**
  ```powershell
  npm run test
  ```
- **End-to-End Test Suite (Playwright):**
  ```powershell
  npm run test:e2e
  ```

---

## 4. URL Endpoints & Navigation Architecture

InfraTrack utilizes clean, top-level shortcut routes that automatically resolve the user's active project preference using the `infratrack_active_project` cookie (with automatic fallback to `agira_active_project`). Next.js server rewrites transparently map these clean URLs to their corresponding project-scoped handlers.

### A. Frontend Web Application Routes

| Shortcut Endpoint | Project-Scoped Route | Feature Description |
| --- | --- | --- |
| `/` | — | Marketing landing page with interactive features showcase, character-by-character TechText watermark, and global theme switch. |
| `/sign-in` | `/sign-in/[[...sign-in]]` | Clerk authentication login screen with persistent theme toggle. |
| `/sign-up` | `/sign-up/[[...sign-up]]` | Clerk authentication registration screen. |
| `/dashboard` | `/projects/[projectId]/dashboard` | **Portfolio & Project Dashboard:** Executive KPIs, project health score, milestone countdown, recent progress feeds. |
| `/agent` | `/projects/[projectId]/assistant` | **Full-Screen AI Agent Workspace:** Split-view PDF viewer, multi-turn LLM chat, citation highlighting, voice dictation, and proposal confirmation actions. |
| `/projects` | — | **Workspace Projects Directory:** List of all accessible infrastructure projects with status filter and quick access. |
| `/projects/new` | — | **Project Onboarding Wizard:** Create a new project, assign project manager, and configure target delivery dates. |
| `/gantt` | `/projects/[projectId]/gantt` | **Critical Path Method (CPM) Gantt:** Interactive SVG Gantt chart with task dependencies, critical path highlights, and slip detection. |
| `/field-intake` | `/projects/[projectId]/field-intake` | **Multi-Modal Field Intake:** Voice memo transcription, text DPR intake, and scanned document OCR processing. |
| `/review-queue` | `/projects/[projectId]/review-queue` | **Candidate Review Workspace:** 3-tier matching queue with 8-signal scoring breakdown, single and batch approvals. |
| `/plan-vs-actual` | `/projects/[projectId]/plan-vs-actual` | **Plan vs. Actual Analysis:** Duration-weighted WBS progress curves compared against baseline linear milestones. |
| `/lookahead` | `/projects/[projectId]/lookahead` | **Rolling Lookahead:** 3-to-6 week lookahead window for sequencing upcoming work and resolving crew handoffs. |
| `/weekly-plan` | `/projects/[projectId]/weekly-plan` | **Weekly Work Plan (LPS):** Weekly commitment tracker with Percent Plan Complete (PPC) and variance root-cause attribution. |
| `/pull-planning` | `/projects/[projectId]/pull-planning` | **Digital Pull Planning:** Collaborative backward-pass planning board organized by trade, zone, and milestone targets. |
| `/roadblocks` | `/projects/[projectId]/roadblocks` | **Roadblocks & Delay Log:** Track constraints, affected activities, trade assignments, and estimated delay impacts. |
| `/impacts` | `/projects/[projectId]/impacts` | **Schedule Impact Requests:** Formal impact proposals for unforeseen site conditions, delay reflows, and baseline adjustments. |
| `/rfis` | `/projects/[projectId]/rfis` | **Requests for Information (RFI):** Technical queries linked to schedule activities with auto-escalation for overdue items. |
| `/submittals` | `/projects/[projectId]/submittals` | **Material & Shop Submittals:** Submittal registry with contractor review statuses and delivery schedule tracking. |
| `/drawings` | `/projects/[projectId]/drawings` | **Drawing Revision Register:** Engineering drawings, revision versioning, and document references. |
| `/files` | `/projects/[projectId]/files` | **Project Document Hub:** Specifications, contract documents, and DPR attachments with inline PDF viewing. |
| `/baselines` | `/projects/[projectId]/baselines` | **Baseline Snapshots:** Frozen schedule baselines with variance detection against the active working schedule. |
| `/tasks` | `/projects/[projectId]` | **WBS Activity Ledger:** Tabular task breakdown structure with status, assignment, date, and weight overrides. |
| `/activity` | `/projects/[projectId]/activity` | **Immutable Audit Log:** Reverse-chronological ledger recording all human and AI updates, approvals, and mutations. |
| `/members` | `/projects/[projectId]/members` | **Project Team Directory:** Role-based access management (Owner, Admin, General Contractor, Trade Partner, Read-Only). |
| `/integrations` | — | **Integrations Hub:** Connected ecosystems (Autodesk Construction Cloud, Procore, CSV import/export pipelines). |
| `/plan` | — | **Enterprise Deployment & Pricing:** Deployment architectures (Cloud, Hybrid, On-Premises Air-Gapped). |

---

### B. Next.js App Router API Endpoints (`/api/*`)

| Method | Endpoint | Description |
| --- | --- | --- |
| `POST` | `/api/projects/active` | Sets or switches the active project cookie (`infratrack_active_project`) with 30-day persistence. |
| `POST` | `/api/assistant/chat` | Streaming LLM assistant endpoint with multi-turn conversation memory, citation retrieval, and tool execution. |
| `POST` | `/api/assistant/actions` | Confirms or cancels proposed schedule/controls mutations (`TASK_CHANGE`, `SCHEDULE_CHANGE`, `ROADBLOCK_CHANGE`, `BASELINE_CHANGE`, `SCHEDULE_IMPACT_CHANGE`, `PROJECT_CONTROL_CHANGE`, `WEEKLY_COMMITMENT_CHANGE`). |
| `POST` | `/api/assistant/attachments` | Secure file and PDF upload for conversational multimodal analysis (supports up to 20MB files). |
| `GET` | `/api/assistant/conversations` | Lists or restores recent AI chat sessions. |
| `GET` | `/api/files/:path*` | Authenticated file streaming endpoint with `SAMEORIGIN` framing headers for the in-app PDF viewer. |
| `POST` | `/api/projects/:projectId/files` | Direct upload of project specifications, drawings, and DPR documentation. |
| `GET` | `/api/integrations/autodesk/connect` | Initiates 3-legged OAuth 2.0 handshake with Autodesk Construction Cloud (ACC). |
| `GET` | `/api/integrations/autodesk/callback` | Handles OAuth authorization code exchange for Autodesk ACC integration. |

---

### C. Python Domain Brain Microservice Endpoints (`http://localhost:8000`)

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/health` | Microservice health check: returns status, engine name, total indexed activities count, and normalization status. |
| `POST` | `/api/retrieval/index` | Indexes WBS activities into BM25 (lexical) and FAISS (dense vector) retrieval stores. |
| `POST` | `/api/retrieval/normalize` | Normalizes colloquial Indian construction terminology, expands abbreviations, and infers discipline tags. |
| `POST` | `/api/retrieval/stage1` | Executes Stage 1 Hybrid Retrieval combining BM25, FAISS, and Reciprocal Rank Fusion ($k=60$). |
| `POST` | `/api/retrieval/match` | Full Stage 1 + Stage 2 matching pipeline: Normalization $\rightarrow$ Hybrid Retrieval $\rightarrow$ 8-Signal Contextual Reranking. |
| `POST` | `/api/extraction/extract` | Structured observation extraction from raw DPR field notes via Gemini / OpenAI (`/api/extraction/analyze` alias). |
| `GET` | `/api/extraction/health` | Connectivity check for the LLM extraction provider. |
| `POST` | `/v1/ocr` | Converts uploaded images (PNG, JPEG, WebP) and scanned PDFs into searchable PDFs with OCR text layers using OCRmyPDF. |

---

## 5. Key System Workflows

### 1. Multi-Modal Field Intake to Master Schedule Linkage
```
[ Daily Field Note / Audio / PDF ]
              │
              ▼
   (1) Terminology Normalization: Expands abbreviations (e.g., "PCC", "RCC", "O&M", "CH 12+500")
              │
              ▼
   (2) Stage 1 Hybrid Retrieval: BM25 lexical match + FAISS dense semantic similarity fused via RRF
              │
              ▼
   (3) Stage 2 Contextual Reranking: Computes composite match score using 8 domain signals:
       • WBS proximity
       • Temporal proximity (planned vs reported date)
       • Trade/discipline alignment
       • Asset/chainage overlap
       • Milestone priority boost
       • Contradiction penalty (-0.40 for opposing activity states)
              │
              ▼
   (4) Review Queue Categorization:
       • High Confidence (≥ 0.70): Auto-matched with high confidence badge
       • Medium Confidence (0.45 – 0.69): Flagged for human verification with explainable score card
       • Low Confidence (< 0.45): Unmatched, routed to manual task assignment
```

### 2. Full-Screen AI Copilot (`/agent`)
- **Split-Screen Workspace:** Left panel hosts the interactive multi-turn chat with real-time tool proposal cards; right panel displays the target engineering drawing, PDF report, or specification document.
- **Citation Anchors:** Clicking citation badges in chat automatically jumps the PDF viewer to the exact page and highlights the referenced passage.
- **Idempotent Proposal Confirmation:** Schedule reflows, roadblock creation, and progress updates generate structured proposal previews. Mutations only apply to the database upon explicit user confirmation, ensuring safety and compliance.

### 3. Global Theme & Visual Experience
- **Instant Global Toggle:** Theme toggle button is accessible from anywhere in the application (including the public landing navigation, authentication pages, dashboard header, and footer).
- **Persistent State:** Theme preference persists globally across sessions using `localStorage` and `data-app-theme` attributes with zero hydration layout shift.
- **TechText Canvas Watermark:** Custom high-performance HTML5 Canvas wordmark at the page footer featuring vector dashed outline reveals, HUD coordinate frames, and calibrated ~1.35 char/sec dwell pacing that gracefully covers every character from `I` through `k`.

---

## 6. Security, Governance & Self-Hosted Freedom

- **100% Free & Open-Source Stack:** All proprietary, paid third-party dependencies have been completely decoupled in favor of open standards.
- **Clerk Authentication & Session Security:** Integrated JWT verification, automated organization workspace provisioning, and cookie security.
- **Strict Role-Based Capability Matrix:** Every mutation (task updates, baseline freezes, impact approvals) validates user permissions before committing to the database.
- **Audit Immutability:** All status updates, progress edits, and AI proposal confirmations create persistent, immutable audit entries with timestamps and actor details.