# InfraTrack PM (SIH Problem Statement 26122)
### Intelligent Data Capture & Schedule-Linking Layer for Infrastructure Project Management: Real-Time Actual Progress Tracking
**Sponsored by:** Oil India Limited (OIL)  
**Location:** `d:/SIH26/sih2`

---

## 1. System Overview

InfraTrack PM is an enterprise-grade infrastructure project controls and progress tracking platform built specifically for Smart India Hackathon Problem Statement 26122. It bridges the critical divide between raw, multi-modal jobsite progress updates (text, audio recordings, scanned PDFs, daily progress reports) and the engineering master schedule.

### Key Architectural Pillars
1. **Multi-Modal Field Intake:** Natural language voice dictation, freeform text DPRs, and scanned document OCR.
2. **AI Entity & Observation Extraction:** Google Gemini (`gemini-2.5-flash` Priority #1) and OpenAI (`gpt-4o-mini` Priority #2) parsing unstructured logs into 1-to-N normalized engineering observations.
3. **Domain Brain & Hybrid Retrieval Microservice:** Python FastAPI service integrating:
   - **BM25 Lexical Search**
   - **FAISS Dense Vector Embeddings**
   - **Reciprocal Rank Fusion (RRF)**
   - **8-Signal Contextual Reranker** (WBS proximity, temporal proximity, trade match, keyword overlap, milestone boost, and a strict -0.40 contradiction penalty)
   - **Terminology Normalization Engine** (100+ domain terms and Indian construction acronyms)
4. **Human-in-the-Loop Review Queue:** 3-tier confidence classification with explainable scoring breakdown and 1-click single/batch approval.
5. **Duration-Weighted WBS Progress Rollup:** $Weight_i = \max(1, EndDate_i - StartDate_i)$ ensuring critical heavy civil activities dominate progress calculations over trivial 1-day tasks.
6. **Project Controls Suite:** SVG Critical Path Method (CPM) Gantt chart, lookaheads, pull planning, roadblock logs, RFIs, submittals, and drawing version control.

---

## 2. Technology Stack

| Layer | Technologies |
| --- | --- |
| **Web Frontend & API** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Lucide Icons |
| **Authentication** | Clerk Auth (`@clerk/nextjs` Core 3) with pre-configured keys |
| **Database & ORM** | PostgreSQL (Neon serverless pooler), Prisma ORM 6.19 |
| **Primary LLM** | **Google Gemini** (`gemini-2.5-flash`) via Vercel AI SDK |
| **Secondary LLM** | **OpenAI** (`gpt-4o-mini`) fallback engine |
| **NLP & Retrieval Microservice** | Python 3.13, FastAPI, Uvicorn, Rank-BM25, FAISS, Pydantic |
| **Document OCR** | Dockerized OCRmyPDF worker (port 8010) + client-side PDF.js rendering |

---

## 3. Quick Start & Execution

### A. Environment Configuration
The `.env` file in `d:/SIH26/sih2/.env` has been configured with active Neon database credentials and Clerk keys. Refer to `d:/SIH26/sih2/.env.example` for the full schema.

Key environment variables:
```bash
DATABASE_URL="postgresql://neondb_owner:npg_gY5y3QcRkdtW@ep-raspy-credit-b3mpsaxm-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_bXV0dWFsLXJhdHRsZXItNTA2MC5jbGVyay5hY2NvdW50cy5kZXYk"
CLERK_SECRET_KEY="sk_test_d3BzQsNcv32Lb4ugC0Up0kuxnJq0gPgu4NHwbsyjA2"
RETRIEVAL_SERVICE_URL="http://localhost:8000"
GEMINI_API_KEY="your_gemini_api_key_here"
```

### B. Launching the Python Retrieval Service
In a terminal window:
```powershell
cd d:\SIH26\sih2\retrieval-service
python -m uvicorn src.server:app --port 8000 --reload
```
Test the health endpoint: `http://localhost:8000/health`

To run the algorithmic unit tests (20 test cases):
```powershell
python -m pytest tests/test_contextual_reranker.py tests/test_terminology_normalizer.py tests/test_bm25_retriever.py
```

### C. Launching the Next.js Web Application
In another terminal window:
```powershell
cd d:\SIH26\sih2
pnpm dev
```
Open your browser to: [http://localhost:3000](http://localhost:3000)

---

## 4. Key Feature Routes

| Feature | URL Path | Description |
| --- | --- | --- |
| **Projects Overview** | `/projects` | Active infrastructure projects dashboard |
| **Field Intake (DPR)** | `/projects/[id]/field-intake` | Voice, text, and PDF daily progress report intake |
| **Review Queue** | `/projects/[id]/review-queue` | 3-tier candidate matching workspace with score breakdown |
| **Plan vs Actual** | `/projects/[id]/plan-vs-actual` | Duration-weighted WBS progress vs linear baseline |
| **Critical Path Gantt** | `/projects/[id]/gantt` | High-performance interactive CPM Gantt chart |
| **Lookahead Planning** | `/projects/[id]/lookahead` | Rolling 3-6 week field lookahead window |
| **Weekly Work Plan** | `/projects/[id]/weekly-plan` | Last Planner System weekly commitments and PPC |
| **Roadblocks & Delays** | `/projects/[id]/roadblocks` | Proactive risk tracking linked to schedule activities |
| **AI Copilot** | `/projects/[id]/assistant` | Grounded AI assistant with permission-checked mutations |

---

## 5. Security & Self-Hosted Freedom

- **100% Free & Open-Source Stack:** All proprietary paid third-party dependencies (e.g., Procore) have been safely decoupled.
- **Clerk Authentication:** Built-in session security, JWT verification, and automated workspace provisioning.
- **Strict Permission Checks:** Every write mutation is validated against user capability matrix before database commits.