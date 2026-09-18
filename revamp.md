# Agira Revamp Specification

This document is the single source of truth for rebranding **BuilderBridge** into **Agira**.
Every parallel worktree branch reads this file and implements only its own section.
Nothing outside a branch's declared file list may be touched.

Baseline commit: `0175022` on `main`.

## 1. Ground rules

The product's functionality does not change.
Every feature that exists today must exist after the revamp, behaving identically.
This is a rebrand plus three infrastructure swaps, not a product redesign.

Three exceptions were explicitly approved, and only these three:

1. Sentry error reporting is removed entirely.
2. Stripe payment processing is removed, while the plan-tier product rules it gated are preserved.
3. Object storage moves from a generic S3 configuration to Cloudflare R2.

No new features.
No new dependencies beyond what the swaps require.
No gradients anywhere in the UI.

## 2. Brand

| Attribute | Old | New |
| --- | --- | --- |
| Product name | BuilderBridge | Agira |
| npm package name | `construction-scheduler` | `agira` |
| Wordmark | `BuilderBridge` | `Agira`, Inter 600, `letter-spacing: -0.02em` |
| Logo mark | Bridge arch with `BB` initials | Three offset horizontal bars, a Gantt row abstracted |
| Accent colour | `#f97316` construction orange | `#2c4a6b` deep steel |
| Log service tag | `builderbridge-web` | `agira-web` |
| Theme storage key | `builderbridge:theme` | `agira:theme` |
| Theme change event | `builderbridge:theme-change` | `agira:theme-change` |
| Service worker cache | `builderbridge-v1` | `agira-v1` |
| Agent name in prompts | BuilderBridge Agent | Agira Agent |
| Default email sender | `BuilderBridge <onboarding@resend.dev>` | `Agira <onboarding@resend.dev>` |

### Voice

Declarative and plain.
State what the product does, then stop.
No hype words, no "revolutionary", no "seamless", no exclamation marks.

Positioning sentence, used in metadata and the marketing footer:

> Agira runs the schedule, the field, and the project documents as one loop, where every AI change is cited, reviewed, and reversible.

Approved headline for the landing hero:

> Every commitment, cited and reversible.

Approved subhead:

> One control room for the schedule, the field, and the documents.

### Logo mark geometry

The mark replaces the bridge arch in `scripts/generate-icons.mjs`.
It is three horizontal bars inside a rounded square, each bar a different length and horizontally offset, reading as three rows of a Gantt chart.
Bars are `#ffffff` on a `#101720` rounded square.
No text initials in the icon.
The maskable variant keeps the existing ten percent safe-zone padding.

### Naming note

Agira Technologies is an existing software services firm in India.
Different sector, no product overlap, but this is worth knowing before a domain purchase.
It does not block the rebrand.

## 3. Design system: Deep Steel

All colour is flat.
There are no gradients in the new design.
The only existing gradient that survives is the one-pixel horizontal rule pattern on `.app-shell`, which is a repeating line grid rather than a colour blend, and it is re-tinted rather than removed.

### Light tokens

These replace the `:root` block in `src/app/globals.css`.
Token names do not change, only their values.
This is deliberate, so that consuming components need no edits when the palette lands.

```
--color-primary:              #101720
--color-primary-active:       #1c2733
--color-primary-disabled:     #dde3ea
--color-ink:                  #101720
--color-body:                 #384654
--color-muted:                #64748b
--color-muted-soft:           #7d8b9c
--color-hairline:             #dde3ea
--color-hairline-soft:        #eaeef3
--color-canvas:               #ffffff
--color-surface-soft:         #f1f4f8
--color-surface-card:         #e6ecf3
--color-surface-strong:       #d4dde7
--color-surface-dark:         #0d1219
--color-surface-dark-elevated:#151b24
--color-on-primary:           #ffffff
--color-on-dark:              #ffffff
--color-on-dark-soft:         #97a5b6
--color-brand-accent:         #2c4a6b
--color-success:              #2f7d63
--color-warning:              #b07a2b
--color-error:                #a83a3a
--color-badge-orange:         #b07a2b
--color-badge-pink:           #9b5f7e
--color-badge-violet:         #6b6191
--color-badge-emerald:        #2f7d63
--color-app-bg:               #f1f4f8
--color-app-panel:            #ffffff
--color-app-sidebar:          #101720
--color-app-accent:           #2c4a6b
--color-app-grid:             rgba(16, 23, 32, 0.03)
```

The four badge colours keep their token names for compatibility, but every value is desaturated so nothing in the interface shouts.
`--color-badge-orange` and `--color-warning` deliberately share a value now; the old design used two different oranges for the same semantic weight.

### Dark tokens

These replace the `.app-shell[data-app-theme="dark"]` block.
Dark mode remains scoped to the authenticated app shell only.
Marketing pages stay on the light `:root` tokens, exactly as today.

```
--color-primary:              #e6ecf4
--color-primary-active:       #d3dce8
--color-primary-disabled:     #2b3543
--color-ink:                  #e6ecf4
--color-body:                 #b9c4d2
--color-muted:                #8b98a8
--color-muted-soft:           #74818f
--color-hairline:             #232c38
--color-hairline-soft:        #1a222c
--color-canvas:               #131920
--color-surface-soft:         #171e27
--color-surface-card:         #1c242f
--color-surface-strong:       #28323f
--color-surface-dark:         #0a0e14
--color-surface-dark-elevated:#101620
--color-on-primary:           #101720
--color-on-dark:              #ffffff
--color-on-dark-soft:         #a9b6c6
--color-brand-accent:         #6b8fb8
--color-success:              #4f9c81
--color-warning:              #cc9a4e
--color-error:                #c96a6a
--color-badge-orange:         #cc9a4e
--color-badge-pink:           #b8809c
--color-badge-violet:         #8a80b0
--color-badge-emerald:        #4f9c81
--color-app-bg:               #0d1219
--color-app-panel:            #151b24
--color-app-sidebar:          #0a0e14
--color-app-accent:           #6b8fb8
--color-app-grid:             transparent
```

### Other token-level changes in `globals.css`

`::selection` changes from `rgba(249, 115, 22, 0.2)` to `rgba(44, 74, 107, 0.16)`.

The `.assistant-theme` dark block currently uses warm near-blacks, including one clearly wrong value, `--assistant-rail: rgba(41, 34, 34, 0.68)`, which is a brown tint sitting among neutral greys.
Re-tint the entire block onto the steel dark ramp and fix that value in passing.

The `.assistant-theme-light` block is already cool-toned and needs only minor alignment to the new hairline and ink values.

Radius tokens, typography scale, spacing, and every `.app-*` utility class keep their current values.
The dashboard layout is already restrained and is not being redesigned.

## 4. Workstreams

Six branches, five of which run in parallel.
Branch six is an integration pass performed after the others merge.

| Branch | Scope | Runs |
| --- | --- | --- |
| `revamp/01-strip-sentry` | Remove Sentry | Parallel |
| `revamp/02-strip-stripe` | Remove Stripe, keep plan tiers | Parallel |
| `revamp/03-cloudflare-r2` | S3 to Cloudflare R2 | Parallel |
| `revamp/04-design-system` | Deep Steel tokens, icons, PWA shell | Parallel |
| `revamp/05-landing` | Marketing surface rebuild | Parallel |
| `revamp/06-brand-sweep` | Remaining brand strings, README, docs | After merge |

### Shared files

Four files are edited by more than one parallel branch:

- `src/lib/env.ts` is edited by branches 01, 02, and 03.
- `.env.example` is edited by branches 01, 02, and 03.
- `package.json` is edited by branches 01 and 02.
- `README.md` is owned exclusively by branch 06. No parallel branch edits it.

Each parallel branch makes only its own additions and deletions in the shared files.
The conflicts are small, adjacent-block conflicts and are resolved during integration.

---

### Branch 01: `revamp/01-strip-sentry`

**Delete these files outright.**

- `src/sentry.server.config.ts`
- `src/sentry.edge.config.ts`
- `src/instrumentation.ts`
- `src/instrumentation-client.ts`
- `src/lib/sentry-privacy.ts`

Next.js treats `instrumentation.ts` and `instrumentation-client.ts` as optional.
Removing them is correct and leaves no dangling registration.

**Edit these files.**

`next.config.ts`
Remove the `withSentryConfig` import and the wrapping call.
Export `nextConfig` directly.
Every security header, the `serverExternalPackages` entry, and the `proxyClientMaxBodySize` setting stay exactly as they are.

`src/lib/observability.ts`
Remove the `@sentry/nextjs` import and the `Sentry.withScope` block inside `reportException`.
`reportException` keeps calling `logger.error` with the sanitised metadata, which is where the actionable signal already lived.
Change `service: "builderbridge-web"` to `service: "agira-web"`.
Change `release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.SENTRY_RELEASE` to `release: process.env.VERCEL_GIT_COMMIT_SHA`.
Keep the `sanitizeMetadata` import from `telemetry-privacy`; the logger still needs it.

`src/app/global-error.tsx`
Remove the Sentry import and the `useEffect` that captures the exception.
Keep the component and its markup.
Change the body copy from "The error has been recorded." to "Try this page again, or return to it in a moment." so the page no longer promises reporting that does not happen.
Leave the inline hex colours alone; branch 04 owns colour.

`src/components/PdfCanvasViewer.tsx`
Remove the Sentry import and both `Sentry.captureException` call sites, at roughly lines 96 and 159.
Replace each with `reportException` from `@/lib/observability`, preserving the `surface` and `operation` tags as metadata so the operational breadcrumb survives.

`src/lib/env.ts`
Remove `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN`.

`.env.example`
Remove the Sentry block and its explanatory comment.

`package.json`
Remove the `@sentry/nextjs` dependency.

`.github/workflows/ci.yml`
No Sentry environment variables are set there today, so confirm and leave unchanged if so.

`scripts/generate-codex-gpt-report.mjs`
Remove Sentry references from whatever report text it generates.

**Verification.**

`npx tsc --noEmit` passes.
`npx eslint src --max-warnings=0` passes.
`npx vitest run tests/unit` passes, including `tests/unit/telemetry-privacy.test.ts`, which must keep passing untouched.
`grep -ri sentry src/ tests/ scripts/ next.config.ts .env.example package.json` returns nothing.

---

### Branch 02: `revamp/02-strip-stripe`

The plan tier system is product behaviour and stays.
Only the payment rails are removed.
After this branch, `PlanTier` still gates active project counts, still gates Procore and Autodesk behind Pro, and still drives the tiered AI monthly allowances.

**Delete these files outright.**

- `src/app/api/webhooks/stripe/route.ts`
- `src/app/actions/billing.ts`
- `src/components/BillingActions.tsx`

**Rename and reduce.**

`src/lib/billing.ts` becomes `src/lib/plans.ts`.

Keep, unchanged in behaviour: `PLAN_LIMITS`, `canCreateProject`, `assertCanCreateProject`, `canUseIntegrations`.
Delete: `isBillingConfigured`, `getStripe`, `stripeClient`, `priceIdForTier`, `tierForPriceId`, and the `Stripe` import.

The error message thrown by `assertCanCreateProject` currently ends with "or upgrade on the Billing page."
Change that to "or contact your organisation owner to raise the limit." so the copy matches a product with no self-serve checkout.

`tests/unit/billing.test.ts` becomes `tests/unit/plans.test.ts`, importing from `@/lib/plans`.
Its existing assertions on `canCreateProject`, `canUseIntegrations`, and `PLAN_LIMITS` all stay.

**Route rename.**

`src/app/(app)/billing/page.tsx` moves to `src/app/(app)/plan/page.tsx`.

The page becomes read-only "Plan and usage".
It keeps the current-plan card and the active-projects-against-limit metric exactly as they render today.
It drops the `upgraded` search param branch, the `BillingActions` block, the `isBillingConfigured` conditional, and the `subscriptionStatus` line.
In place of the change-plan card, show a short card explaining which limits the current plan applies and that plan changes are handled by the organisation owner.
Keep the link through to `/pricing`.

Update the three inbound links:

- `src/components/AppNavLinks.tsx`, line 14: `href` and `match` become `/plan`, label becomes `Plan`.
- `src/components/AutodeskIntegrationPanel.tsx`, around line 72.
- `src/components/ProcoreIntegrationPanel.tsx`, around line 74.

**Database.**

Add one migration, `prisma/migrations/<timestamp>_remove_stripe_billing_columns/migration.sql`.

Drop from `Organization`: `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`.
Keep `planTier` and the `PlanTier` enum.
Remove the same three fields and the `@unique` on `stripeCustomerId` from `prisma/schema.prisma`.

Do not edit any of the 27 existing migration files.
Migration history is append-only.

**Other edits.**

`src/proxy.ts`
Remove `"/api/webhooks/stripe"` from `PUBLIC_PATHS` and the comment above it.

`src/app/pricing/page.tsx`
Remove checkout calls and Stripe conditionals.
The three tiers stay as marketing content with their feature lists intact.
CTAs become "Get started" pointing at `/sign-up` for Free, and "Contact us" for Core and Pro.
Do not restyle this page; branch 05 owns marketing visuals.

`src/lib/env.ts`
Remove `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CORE`, `STRIPE_PRICE_PRO`.

`.env.example`
Remove the Stripe block.

`package.json`
Remove the `stripe` dependency.

**Verification.**

`npx prisma validate` passes.
`npx tsc --noEmit` passes.
`npx eslint src --max-warnings=0` passes.
`npx vitest run tests/unit` passes.
`grep -ri stripe src/ tests/ prisma/schema.prisma .env.example package.json` returns nothing.
A grep for `/billing` across `src/` returns nothing.

---

### Branch 03: `revamp/03-cloudflare-r2`

R2 speaks the S3 API, so `@aws-sdk/client-s3` stays as the wire protocol.
This is a configuration and naming change, not a rewrite.
The local-disk development fallback and the authenticated `/api/files` route are untouched.

**`src/lib/env.ts`**

Replace the S3 block with:

```
R2_ACCOUNT_ID           optional string
R2_ACCESS_KEY_ID        optional string
R2_SECRET_ACCESS_KEY    optional string
R2_BUCKET               optional string
R2_PUBLIC_URL           optional string
```

`S3_REGION` is deleted rather than renamed.
R2 is always `auto`, so the value is hardcoded in `storage.ts` and does not belong in configuration.

`R2_PUBLIC_URL` replaces `S3_PUBLIC_URL` and keeps the same purpose: rewriting legacy absolute stored URLs onto the authenticated file route.
It is still optional and still deprecated for new uploads.

**`src/lib/storage.ts`**

The configured check becomes all four of account id, access key id, secret access key, and bucket being present.

The endpoint is derived rather than configured:

```
https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com
```

Client construction becomes `region: "auto"` with `forcePathStyle: true`, which R2 supports.

Rename `isDurableStorageConfigured`'s backing constant from `s3Configured` to `r2Configured`, and the `getS3Client` helper to `getR2Client`.
The exported function names `isDurableStorageConfigured`, `uploadFile`, `readStoredFile`, `deleteStoredFile`, `storageFileUrl`, `privateStoredFileUrl`, `normalizeStorageKey`, and `buildStorageKey` do not change, because callers across the app depend on them.

`validatedS3Range` becomes `validatedR2Range`.

In `privateStoredFileUrl`, the legacy base list uses `env.R2_PUBLIC_URL` and the derived R2 endpoint plus bucket.

The `CacheControl: "private, no-store"` header on upload stays.
Range request handling stays byte-for-byte identical; R2 honours the `Range` header the same way.

**`.env.example`**

Replace the S3 block with an R2 block.
Document where to find the account id and how to mint an R2 API token.
State plainly that the bucket must be private, and that Agira streams authorised files through `/api/files`, so no public bucket URL and no browser-side key is required.
Remove the dangling `See DEPLOYMENT.md for setup steps.` reference, because that file does not exist and is git-ignored anyway.

**Tests.**

`tests/integration/storage-supabase.test.ts` becomes `tests/integration/storage-r2.test.ts`, with its environment setup and assertions moved onto the `R2_*` variables.
`tests/unit/storage.test.ts` and `tests/e2e/storage.spec.ts` update their environment variable names and any brand strings in fixture paths.

**Documentation.**

Create `docs/deployment.md` covering the R2 bucket setup, the required environment variables, and the Neon database and Vercel deployment steps.
It goes in `docs/` because the repository's `.gitignore` excludes a root-level `DEPLOYMENT.md` as agent-generated scratch.

**Verification.**

`npx tsc --noEmit` passes.
`npx eslint src --max-warnings=0` passes.
`npx vitest run tests/unit` passes.
`grep -rn 'S3_' src/ tests/ .env.example` returns nothing.
Uploading and reading a file through the local-disk fallback still works, which the storage unit tests already cover.

---

### Branch 04: `revamp/04-design-system`

This branch owns colour, the icon, and the application shell chrome.
It does not touch marketing page structure; branch 05 owns that.

**`src/app/globals.css`**

Replace the `:root` and `.app-shell[data-app-theme="dark"]` token blocks with the values in section 3 of this document.
Update `::selection`.
Re-tint the `.assistant-theme` and `.assistant-theme-light` blocks onto the steel ramp, and fix the brown `--assistant-rail` value noted in section 3.
Leave the `@theme inline` mapping, every `.app-*` utility, the radius scale, the media queries, and the reduced-motion block exactly as they are.

**`src/lib/app-theme.ts`**

`APP_THEME_STORAGE_KEY` becomes `agira:theme`.
`APP_THEME_CHANGE_EVENT` becomes `agira:theme-change`.

This resets the stored theme preference for anyone who had chosen dark.
That is acceptable for a rebrand and the default of light is correct behaviour on a miss.

**`src/app/(app)/layout.tsx`**

No change needed.
An earlier draft of this spec claimed this file contains an inline `appShellThemeScript` with a hardcoded `builderbridge:theme` string.
It does not.
The key lives only in `src/lib/app-theme.ts` and is consumed through `AppThemeProvider`, so changing the constant is sufficient and self-consistent.

**`src/app/layout.tsx`**

`metadata.title` becomes `Agira — Construction Operations`, written with a plain dash.
`metadata.description` becomes the positioning sentence from section 2.
`appleWebApp.title` becomes `Agira`.
`viewport.themeColor` becomes `#101720`.

**`src/app/manifest.ts`**

`name` becomes `Agira — Construction Operations`, again with a plain dash.
`short_name` becomes `Agira`.
`description` becomes the positioning sentence.
`theme_color` becomes `#101720`.
`start_url` stays `/projects`.

**`scripts/generate-icons.mjs`**

Replace the bridge-arch SVG with the three-bar mark described in section 2.
Background `#101720`, bars `#ffffff`, no text initials.
Keep the four output sizes and the maskable safe-zone padding.
Run the script and commit the four regenerated PNGs under `public/icons/`.
Regenerate `src/app/favicon.ico` from the same mark.

**`public/sw.js`**

Change `CACHE_NAME` from `builderbridge-v1` to `agira-v1`.
The rename is what forces old clients to drop the stale cache, so it is required, not cosmetic.
Update the header comment.

**`public/offline.html`**

Update the title, the image alt text, and the body copy to Agira.
Re-tint its inline colours onto the steel palette.

**`public/agent-icon.png` and `public/auth/auth-panel.png`**

Both carry old brand visuals.
Regenerate or replace them on the steel palette.
If a faithful replacement is not possible in this branch, note it in the branch summary rather than shipping the old asset.

**Verification.**

`npx tsc --noEmit` passes.
`npx eslint src --max-warnings=0` passes.
`npm run build` succeeds.
No occurrence of `#f97316`, `#fb923c`, `#ea580c`, or `#d85d0b` remains in `src/app/globals.css`.
Toggling dark mode in the app shell produces no flash of the wrong theme on reload.

---

### Branch 05: `revamp/05-landing`

The entire marketing surface is rebuilt.
This is the largest branch, roughly 2,750 lines across seven files.

**Delete.**

- `src/components/LandingHero.tsx`
- `public/videos/construction-hero.mp4`

The hero video and its three stacked black gradient scrims are exactly what the new direction rules out.

**Create.**

`src/components/landing/AgiraHero.tsx`

A flat `--color-app-bg` canvas.
Left column: an eyebrow, the approved headline, the approved subhead, a primary and a ghost CTA.
Right column: a product panel built in JSX, not a screenshot, showing a weekly plan with three commitment rows, a status indicator per row, and a footer line reading how many proposals are open.
Hairline borders throughout.
No scrims, no gradients, no drop shadows heavier than a single soft elevation.

The CTA respects `isSignedIn` exactly as the old hero did: signed in goes to `/projects` and reads "Open your projects", signed out goes to `/sign-up` and reads "Get started free".

**Rewrite.**

`src/app/page.tsx`

Section order:

1. Navigation
2. Hero
3. Proof strip, a single row of plain metrics on a hairline-bounded band
4. The operating loop
5. Cited and reversible, the safe-AI-write explanation
6. Product showcase tabs
7. Roles
8. Integrations
9. Closing call to action
10. Footer

The existing bands carry good content.
Restyle them and rewrite their copy into the Agira voice.
Do not invent new product claims; every statement must describe something the application actually does.

`src/components/LandingMegaNav.tsx`

Keep the structure.
Twenty-two feature and solution detail pages resolve through these links, and breaking them breaks real routes.
Restyle onto the steel palette, replace the wordmark, and keep `LandingAnnouncementBar` mounted where it is at line 363.

`src/components/LandingAnnouncementBar.tsx`

New copy in the Agira voice.
Restyle onto steel.

`src/components/LandingProductShowcase.tsx`

Keep the four tabbed views and their data.
Restyle the toolbar, the tab affordance, and `STATUS_COLOR` onto the steel palette.

`src/components/MarketingFooter.tsx`

Keep the four-column structure and every link target.
Replace the orange `B` tile with the new mark, the wordmark with `Agira`, and the oversized ghost wordmark at the bottom.
Restyle the hardcoded `#f3f4f5`, `#dedfe1`, `#171717`, and `#dfe1e2` values onto steel tokens.

`src/components/MarketingDetailPage.tsx`

Restyle. Structure and props unchanged.

`src/lib/marketing-content.ts`

Twenty-two page entries.
Update copy to the Agira voice.
Every `slug` value must stay exactly as it is, because they are live routes referenced from the mega nav and the footer.

`src/app/pricing/page.tsx`

Restyle only.
Branch 02 already removed the Stripe wiring.
If both branches touch this file, branch 02's functional change wins and branch 05's styling is reapplied on top during integration.

**Constraints.**

Consume the `--color-*` tokens.
Do not hardcode hex values in components; the current marketing code does this in seven files and that is the thing being fixed.
No gradient utilities: no `bg-gradient-to-*`, no `from-*`, no `via-*`, no `to-*`.
Every interactive element keeps a visible focus ring.
`tests/e2e/accessibility.spec.ts` must still pass.

**Verification.**

`npx tsc --noEmit` passes.
`npx eslint src --max-warnings=0` passes.
`npm run build` succeeds.
`grep -rnE 'bg-gradient|from-\[#|via-\[#' src/app/page.tsx src/components/` returns nothing.
Every route under `/features/[slug]` and `/solutions/[slug]` still renders for all 22 slugs.

---

### Branch 06: `revamp/06-brand-sweep`

Runs after branches 01 through 05 merge.
It exists as a separate pass because a 155-occurrence string sweep run in parallel would conflict with every other branch.

Replace remaining brand strings across the application shell, the libraries, the tests, and the documentation.

Application chrome and components:
`src/components/NavBar.tsx`, `AuthShell.tsx`, `UserMenu.tsx`, `GlobalAssistant.tsx`, `ProjectFilesBrowser.tsx`, `ProjectSetupChecklist.tsx`, `ServiceWorkerRegistrar.tsx`, `ai-elements/AssistantActionProposal.tsx`, `AutodeskIntegrationPanel.tsx`, `ProcoreIntegrationPanel.tsx`.

Libraries:
`src/lib/ai-assistant.ts`, `assistant-tools.ts`, `email.ts`, `document-extraction.ts`, `openrouter.ts`, `pdf-viewer.ts`.

Routes:
`src/app/api/assistant/chat/route.ts`, `src/app/sign-in/page.tsx`, `src/app/features/[slug]/page.tsx`, `src/app/solutions/[slug]/page.tsx`.

Data and scripts:
`prisma/seed.ts`, `scripts/generate-codex-gpt-report.mjs`.

Tests:
`tests/e2e/project-files.spec.ts`, `tests/integration/file-access.test.ts`, `tests/unit/document-extraction.test.ts`, `email.test.ts`, `file-access-audit.test.ts`, `file-uploads.test.ts`.

`package.json`
`name` becomes `agira`.

**The DOM CustomEvent names, which are the one genuinely dangerous part of this branch.**

Nine `window` CustomEvent names are namespaced with the old brand, and they are how components talk to each other at runtime:

```
builderbridge:toggle-assistant              4 files
builderbridge:assistant-state               2 files
builderbridge:open-assistant-conversation   2 files
builderbridge:open-project-file-agent       2 files
builderbridge:ask-project-file              1 file
builderbridge:raise-rfi-from-file           1 file
builderbridge:open-pdf-viewer               1 file (centralised in PDF_VIEWER_EVENT)
builderbridge:theme                         owned by branch 04
builderbridge:theme-change                  owned by branch 04
```

These are matched by string equality at runtime.
Renaming a dispatcher without its listener silently breaks the feature: the assistant panel stops opening, the PDF viewer stops responding, and nothing fails.
No typecheck, no lint rule, and no existing test catches it.

So rename each event across every one of its sites in a single edit, then verify by grepping that the count of occurrences per new event name equals the count the old name had.
Do not rename them one file at a time.

While you are here: `builderbridge:ask-project-file` and `builderbridge:raise-rfi-from-file` have listeners in `GlobalAssistant.tsx` and no dispatcher anywhere in the codebase.
That is pre-existing dead code, not something this rebrand introduced.
Rename them along with the rest and leave the dead-code question alone; removing them is a product decision outside this work.

`src/lib/plans.ts`
The error message in `assertCanCreateProject` says "contact your organisation owner".
Change "organisation" to "organization" to match the American spelling used everywhere else in the codebase.

`src/lib/email.ts`
The shared email shell renders the wordmark and the default CTA label "Open BuilderBridge".
Update both.
Re-tint the inline email HTML colours onto steel; `#111111` becomes `#101720`, `#374151` becomes `#384654`, `#e5e7eb` becomes `#dde3ea`.
Email clients need inline hex, so these stay literal rather than tokenised.

`src/lib/env.ts`
`EMAIL_FROM` default becomes `Agira <onboarding@resend.dev>`.

`README.md`
Full rewrite.
The current version is a hackathon submission document with a live demo URL, a YouTube link, a judging walkthrough, and CI badges pointing at `github.com/Akash8585/builderbridge`.
None of that survives a rebrand.
Rewrite as a straightforward project README: what Agira is, the stack, local setup, environment variables, the test commands, and the deployment pointer to `docs/deployment.md`.
Remove the demo and judging sections.
Keep the seeded demo account table, because it is genuinely useful for local setup.

Seed demo data such as `alex@harborview.demo` and "Harborview Residences" is fictional project content, not branding.
Leave it alone.

**Verification.**

`grep -rniE 'builderbridge|builder bridge|construction-scheduler' .` excluding `node_modules`, `.git`, and `package-lock.json` returns nothing.
`npx tsc --noEmit` passes.
`npx eslint src --max-warnings=0` passes.
`npx vitest run tests/unit` passes.
`npm run build` succeeds.

## 5. Integration sequence

Merge in dependency order, running the full gate after each merge rather than at the end.

1. `revamp/01-strip-sentry`
2. `revamp/02-strip-stripe`
3. `revamp/03-cloudflare-r2`
4. `revamp/04-design-system`
5. `revamp/05-landing`
6. `revamp/06-brand-sweep`

Branches 01, 02, and 03 are merged first because they collide only in `src/lib/env.ts`, `.env.example`, and `package.json`, where the conflicts are adjacent deletions and trivial to resolve.
Branch 04 lands before 05 so the landing rebuild is verified against the real palette rather than the old one.
Branch 06 lands last so the string sweep runs over settled code.

After every merge:

```
npx prisma generate
npx eslint src --max-warnings=0
npx tsc --noEmit
npx vitest run tests/unit
npm run build
```

`package-lock.json` is regenerated once, on the integration branch, after branches 01 and 02 have both removed their dependencies.
Do not regenerate it inside the parallel branches; that guarantees a conflict on a 508 kilobyte file.

## 6. Definition of done

- No occurrence of `builderbridge`, `builder bridge`, or `construction-scheduler` anywhere outside `.git`.
- No occurrence of `sentry` or `stripe` in source, tests, configuration, or dependencies.
- No occurrence of `S3_` in source, tests, or `.env.example`.
- No gradient utility or hardcoded orange in any component.
- Lint, typecheck, unit tests, and production build all pass on the integration branch.
- The 22 marketing detail routes, the authenticated dashboard, the Gantt, the weekly plan, and the agent proposal flow all render and behave as they did before the revamp.
- Plan tiers still cap active projects, still gate Procore and Autodesk behind Pro, and still apply tiered AI allowances.

## 7. Known follow-ups, deliberately out of scope

The five PNGs under `docs/` are screenshots of the old interface showing the old brand.
They will be stale the moment this work lands.
They must be re-captured against the running Agira build before the README is considered finished.
This is tracked as the final task after integration, not inside any branch, because it needs a running application.

`prisma/seed-assets/SOURCES.md` credits the source of three public-domain reference PDFs and mentions the old brand in passing.
It is attribution text for third-party documents rather than product branding.
Update the product name where it appears, leave the attributions intact.
