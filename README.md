# Agira

Agira runs the schedule, the field, and the project documents as one loop, where every AI change is cited, reviewed, and reversible.

It is built for project managers, schedulers, superintendents, and trade partners who need the office plan and the jobsite to stay aligned.
The Agent inside the app reads live project data, cites the source of every claim, and prepares changes that a human reviews and confirms before anything is written.

## What ships today

| Area | Coverage |
| --- | --- |
| Auth and orgs | Email/password and Google sign-in, organizations, invites, project roles (manager, scheduler, superintendent, trade), project archiving |
| Planning | Dependencies with cycle detection, critical-path method, critical-path Gantt, lookaheads, pull planning, weekly commitments, PPC, owned roadblocks |
| Project controls | Schedule impact requests, RFIs (including overdue linked-task blocking), submittals, drawings with revision history, baselines |
| Documents | Private uploads, project file workspace, PDF text extraction, optional OCR for scans, in-app PDF viewer, page-aware search and citations |
| Portfolio | Executive dashboard, shared timeline, PPC/PRR/S-curves, baseline variance, trade performance, activity history |
| Agent | Persistent project and portfolio chats, read tools, reviewable write proposals, confirmation, permission checks, stale-data checks, atomic writes, tiered usage limits |
| Platform | Responsive UI, installable PWA, optional Resend / Procore sandbox / Autodesk APS integrations |

Plan tiers gate active project counts, gate the Procore and Autodesk integrations behind Pro, and set the tiered monthly Agent allowance.
There is no self-serve billing; plan changes go through the organization owner.

## Safe AI action workflow

```text
User request
  -> project-scoped data and document search
  -> agent-generated proposal
  -> changes, sources, warnings, and impacts shown
  -> explicit user confirmation
  -> permission and stale-data recheck
  -> atomic database transaction
  -> activity log and linked result
```

The Agent does not silently modify project data.
Every proposal shows its sources, expires after a fixed window, and is re-checked for permissions and stale data at confirm time.

## Tech stack

| Area | Technology |
| --- | --- |
| Web | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Agent | Vercel AI SDK (`ai`, `@ai-sdk/react`, `@ai-sdk/openai-compatible`), Streamdown |
| Runtime LLM | OpenRouter, via an OpenAI-compatible API |
| Data | Prisma 6, PostgreSQL (Neon in production) |
| Auth | Better Auth (email/password, Google OAuth, organizations) |
| Files | Cloudflare R2 (S3-compatible) private object storage, PDF.js, unpdf, optional OCRmyPDF worker |
| Integrations (optional) | Resend, Procore sandbox OAuth, Autodesk APS/ACC OAuth |
| Ops | Vercel, Google Cloud Run (OCR worker), structured JSON logs |

## Local setup

### Prerequisites

- Node.js 20+
- PostgreSQL (Neon recommended)
- Docker, optional, for scanned-PDF and image OCR

### 1. Install

```bash
git clone <this-repository-url>
cd agira
npm install
```

### 2. Environment

```bash
cp .env.example .env
```

Minimum required values:

```dotenv
DATABASE_URL="postgresql://..."
BETTER_AUTH_SECRET="replace-with-at-least-32-random-bytes"
BETTER_AUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

Add `OPENROUTER_API_KEY` to exercise the Agent locally.
Without it, the Agent panel shows a "not configured" message but the rest of the app works normally.

### 3. Database

```bash
npx prisma migrate deploy
npm run db:seed
```

The seed script creates a demo organization, a fully populated demo project, and the accounts listed below.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).
If port 3000 is busy, Next.js prints the alternate port.

### Optional OCR worker

Scanned PDFs and images without extractable text go through a self-hosted OCRmyPDF worker.
Searchable PDFs do not need it.

Set the same long random `OCR_SERVICE_TOKEN` in the app and worker environments, then:

```bash
docker compose -f docker-compose.ocr.yml up --build
```

## Demo accounts

Seeded by [`prisma/seed.ts`](./prisma/seed.ts), password `HarborDemo1!` for all of them.

| Role | Email |
| --- | --- |
| Project Manager | `alex@harborview.demo` |
| Scheduler | `jordan@harborview.demo` |
| Superintendent | `morgan@harborview.demo` |
| Trade, electrical | `diego@harborview.demo` |
| Trade, plumbing | `priya@harborview.demo` |

## Environment variables

Full placeholders live in [`.env.example`](./.env.example).
Summary:

| Capability | Variables | Notes |
| --- | --- | --- |
| Core | `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` | Required. Prefer a pooled Neon URL with `sslmode=require`. |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Required by the env schema. Local callback: `/api/auth/callback/google`. |
| Agent | `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Optional. Defaults to `openrouter/free`. |
| Agent resilience | `OPENROUTER_FALLBACK_MODELS`, `OPENROUTER_MAX_RETRIES` | Defaults to `openrouter/free` fallbacks; retries 0-5. |
| Agent limits | `AI_CHAT_RATE_LIMIT_PER_MINUTE`, `AI_MONTHLY_LIMIT_FREE`, `AI_MONTHLY_LIMIT_CORE`, `AI_MONTHLY_LIMIT_PRO` | Per-user burst limit and per-organization monthly allowance by plan tier. |
| Files | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL` | Optional locally, falls back to local disk; required in production. `R2_PUBLIC_URL` is a legacy compatibility path only. |
| OCR | `OCR_SERVICE_URL`, `OCR_SERVICE_TOKEN`, `OCR_SERVICE_TIMEOUT_MS` | Optional; timeout defaults to 120s. |
| Procore | `PROCORE_CLIENT_ID`, `PROCORE_CLIENT_SECRET`, `PROCORE_REDIRECT_URI`, `PROCORE_ENV` | Optional; defaults to sandbox. |
| Autodesk | `AUTODESK_CLIENT_ID`, `AUTODESK_CLIENT_SECRET`, `AUTODESK_REDIRECT_URI` | Optional APS/ACC OAuth. |
| Email | `RESEND_API_KEY`, `EMAIL_FROM` | Optional; delivery is skipped when unset. |

## Testing

```bash
npx tsc --noEmit
npx eslint src --max-warnings=0
npx vitest run tests/unit
npx vitest run tests/integration
npx playwright test
```

Unit tests cover pure logic: permissions, critical path, document extraction, and Agent intent parsing.
Integration tests run against a real PostgreSQL fixture database and cover Agent propose/confirm, document search, storage, and planning writes; they need `TEST_DATABASE_URL` (or `DATABASE_URL`) pointed at a disposable database.
Playwright covers browser flows: auth, the Gantt, the weekly plan, project files, onboarding, and Agent paths such as RFI creation, task progress, weekly commitments, baselines, and schedule-impact proposals through the confirmation UI.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, and a production build on every push and pull request.
Integration tests run when a `TEST_DATABASE_URL` secret is configured; Playwright runs on manual dispatch against a seeded database.

## Deployment

See [`docs/deployment.md`](./docs/deployment.md) for the Cloudflare R2 bucket setup, the required environment variables, and the Neon and Vercel deployment steps.

```bash
npx prisma migrate deploy
```

Do not run `npm run db:seed` against a production database.

## Security and permissions

- Session auth via Better Auth; app routes require a signed-in user and organization or project membership where applicable.
- Project roles gate schedule edits, commitments, roadblocks, and controls; Agent confirmation rechecks the same capabilities.
- Uploaded objects are private; browsers load files through authenticated `/api/files/...` streams.
- Agent proposals are user-owned, expire, and are confirmed at most once after a snapshot check.
- Optional file-access auditing and project activity history record sensitive reads and writes.
- Storage keys, OpenRouter keys, and OCR tokens stay server-side, never `NEXT_PUBLIC_`.

## License

MIT
#   s i h  
 