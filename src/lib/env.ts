import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  
  // Clerk Authentication
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: z.string().default("/sign-in"),
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: z.string().default("/sign-up"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: z.string().default("/projects"),
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: z.string().default("/projects"),

  // Retrieval Microservice (Python FastAPI BM25 + FAISS + Contextual Reranker)
  RETRIEVAL_SERVICE_URL: z.string().default("http://localhost:8000"),

  // LLM Providers: Google Gemini is Priority #1, OpenAI is Priority #2
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: z.string().default("openrouter/free"),
  OPENROUTER_FALLBACK_MODELS: z.string().default("openrouter/free"),

  // Retries and Rate Limits
  ASSISTANT_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_CHAT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).max(300).default(30),
  AI_MONTHLY_LIMIT_FREE: z.coerce.number().int().min(1).default(250),
  AI_MONTHLY_LIMIT_CORE: z.coerce.number().int().min(1).default(2500),
  AI_MONTHLY_LIMIT_PRO: z.coerce.number().int().min(1).default(10000),

  // Storage (Cloudflare R2 or local fallback)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // OCRmyPDF Worker
  OCR_SERVICE_URL: z.string().optional(),
  OCR_SERVICE_TOKEN: z.string().optional(),
  OCR_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(300_000).default(120_000),

  // Email notifications (optional)
  GOOGLE_USER: z.string().optional(),
  GOOGLE_AUTH_APP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
  console.warn(`[Env Warning]: Some environment variables did not parse:\n${issues}`);
}

export const env = (parsed.success ? parsed.data : {
  DATABASE_URL: process.env.DATABASE_URL || "",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || "",
  CLERK_SECRET_KEY: process.env.CLERK_SECRET_KEY || "",
  NEXT_PUBLIC_CLERK_SIGN_IN_URL: "/sign-in",
  NEXT_PUBLIC_CLERK_SIGN_UP_URL: "/sign-up",
  NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL: "/projects",
  NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL: "/projects",
  RETRIEVAL_SERVICE_URL: process.env.RETRIEVAL_SERVICE_URL || "http://localhost:8000",
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4o-mini",
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: "openrouter/free",
  OPENROUTER_FALLBACK_MODELS: "openrouter/free",
  ASSISTANT_MAX_RETRIES: 2,
  AI_CHAT_RATE_LIMIT_PER_MINUTE: 30,
  AI_MONTHLY_LIMIT_FREE: 250,
  AI_MONTHLY_LIMIT_CORE: 2500,
  AI_MONTHLY_LIMIT_PRO: 10000,
  OCR_SERVICE_TIMEOUT_MS: 120000,
}) as z.infer<typeof envSchema>;
