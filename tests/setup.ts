// Load .env for every test suite explicitly. Without this, suites only got
// env vars as a side effect of importing @prisma/client (which auto-loads
// .env) — pure-logic suites that skip Prisma would crash in lib/env.ts.
import "dotenv/config";
