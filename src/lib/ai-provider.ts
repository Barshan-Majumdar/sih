import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "@/lib/env";

/**
 * Assistant model providers, tried in order: OpenAI first, then Gemini, then
 * OpenRouter as the final safety net.
 *
 * OpenAI leads because it is the core engine for the document-grounded (RAG)
 * path in the assistant chat route, where answer quality over retrieved
 * evidence matters most. Gemini is the second choice and takes over whenever
 * OpenAI is unavailable, out of quota, or rate limited.
 *
 * All three speak the OpenAI chat-completions wire format, so a single
 * createOpenAICompatible factory covers them and the calling code never learns
 * which one answered.
 *
 * A provider is "configured" when its API key is present. Unconfigured
 * providers are skipped rather than failing, so a deployment can run on any
 * subset of the three.
 */

export class AssistantNotConfiguredError extends Error {}

export type ProviderId = "gemini" | "openai" | "openrouter";

type ProviderSpec = {
  id: ProviderId;
  baseURL: string;
  apiKey: string | undefined;
  model: string;
  headers?: Record<string, string>;
};

/** Order is the fallback order. Do not reorder without changing the docs. */
function providerSpecs(): ProviderSpec[] {
  return [
    {
      id: "gemini",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      apiKey: env.GEMINI_API_KEY,
      model: env.GEMINI_MODEL,
    },
    {
      id: "openai",
      baseURL: "https://api.openai.com/v1",
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_MODEL,
    },
    {
      id: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: env.OPENROUTER_API_KEY,
      model: env.OPENROUTER_MODEL,
      headers: { "X-Title": "InfraTrack" },
    },
  ];
}

export function configuredProviders(): ProviderSpec[] {
  return providerSpecs().filter((spec) => Boolean(spec.apiKey));
}

export function isAssistantConfigured(): boolean {
  return configuredProviders().length > 0;
}

/** Ordered provider ids, for logging and for the "which model" surface. */
export function getAssistantProviderOrder(): ProviderId[] {
  return configuredProviders().map((spec) => spec.id);
}

/** Ordered "provider/model" labels, replacing the old model-order list. */
export function getAssistantModelOrder(): string[] {
  return configuredProviders().map((spec) => `${spec.id}/${spec.model}`);
}

type ChatModelFactory = (model: string) => ReturnType<
  ReturnType<typeof createOpenAICompatible>["chatModel"]
>;

const clients = new Map<ProviderId, ChatModelFactory>();

/**
 * OpenAI uses the first-party provider: its newer models reject `max_tokens`
 * and require `max_completion_tokens`, which the generic OpenAI-compatible
 * client does not know to send. Gemini and OpenRouter are fine on the generic
 * client.
 */
function clientFor(spec: ProviderSpec): ChatModelFactory {
  let client = clients.get(spec.id);
  if (!client) {
    if (spec.id === "openai") {
      const openai = createOpenAI({ apiKey: spec.apiKey! });
      client = (model) => openai(model) as ReturnType<ChatModelFactory>;
    } else {
      const compatible = createOpenAICompatible({
        name: spec.id === "gemini" ? "google" : spec.id,
        baseURL: spec.baseURL,
        apiKey: spec.apiKey!,
        ...(spec.headers ? { headers: spec.headers } : {}),
      });
      client = (model) => compatible.chatModel(model);
    }
    clients.set(spec.id, client);
  }
  return client;
}

/** Mirrors the AI SDK's provider-options shape, which must be JSON-encodable. */
type JsonValue = null | string | number | boolean | { [key: string]: JsonValue } | JsonValue[];
type ProviderOptions = Record<string, Record<string, JsonValue>>;

export type AssistantAttempt = {
  id: ProviderId;
  model: ReturnType<ReturnType<typeof createOpenAICompatible>["chatModel"]>;
  requestOptions: { maxRetries: number; providerOptions?: ProviderOptions };
};

/**
 * Every configured provider, in fallback order, ready to call.
 *
 * OpenRouter keeps its model-level fallback options; the other two have no
 * equivalent, so they carry none rather than a meaningless key.
 */
export function getAssistantAttempts(): AssistantAttempt[] {
  const specs = configuredProviders();
  if (specs.length === 0) {
    throw new AssistantNotConfiguredError(
      "Agent isn't configured yet - set GEMINI_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY."
    );
  }

  return specs.map((spec) => ({
    id: spec.id,
    model: clientFor(spec)(spec.model),
    requestOptions: {
      maxRetries: env.ASSISTANT_MAX_RETRIES,
      ...(spec.id === "openrouter" ? { providerOptions: openRouterProviderOptions() } : {}),
    },
  }));
}

/** Exported for testing: shapes OpenRouter's own model-level fallback list. */
export function openRouterProviderOptions(
  primaryModel = env.OPENROUTER_MODEL,
  configuredFallbacks = env.OPENROUTER_FALLBACK_MODELS
): ProviderOptions {
  const seen = new Set([primaryModel]);
  const fallbacks = configuredFallbacks
    .split(",")
    .map((model) => model.trim())
    .filter((model) => {
      if (!model || seen.has(model)) return false;
      seen.add(model);
      return true;
    });
  return {
    openrouter: {
      ...(fallbacks.length ? { models: fallbacks } : {}),
      provider: { allow_fallbacks: true },
    },
  };
}

/**
 * Runs `call` against each configured provider in order, moving on when a
 * provider fails for a reason another provider could plausibly survive.
 *
 * Authentication, credit, and transient-capacity failures are provider-local,
 * so they fall through. A malformed request or a caller abort fails the same
 * way everywhere, so those stop immediately rather than burning every key.
 */
export async function withProviderFallback<T>(
  call: (attempt: AssistantAttempt) => Promise<T>,
  onFallback?: (failed: ProviderId, error: unknown, next: ProviderId) => void
): Promise<T> {
  const attempts = getAssistantAttempts();
  let lastError: unknown;

  for (let index = 0; index < attempts.length; index++) {
    try {
      return await call(attempts[index]);
    } catch (error) {
      lastError = error;
      if (!shouldTryNextProvider(error, index === attempts.length - 1)) throw error;
      onFallback?.(attempts[index].id, error, attempts[index + 1].id);
    }
  }

  throw lastError;
}

/**
 * Whether a failure from one provider is worth retrying on the next.
 *
 * An abort came from the caller and a malformed request will be rejected
 * identically everywhere, so neither justifies spending another provider's
 * quota. Everything else (auth, credits, capacity, unknown) is provider-local.
 */
export function shouldTryNextProvider(error: unknown, isLast: boolean): boolean {
  if (isLast) return false;
  const kind = classifyProviderError(error);
  return kind !== "aborted" && kind !== "invalid-request";
}

function errorDetails(error: unknown, seen = new Set<unknown>()): string[] {
  if (!error || seen.has(error)) return [];
  seen.add(error);

  if (typeof error === "string") return [error];
  if (!(error instanceof Error)) return [];

  const details = [error.message];
  const extended = error as Error & { cause?: unknown; errors?: unknown[]; statusCode?: number; status?: number };
  if (extended.statusCode) details.push(String(extended.statusCode));
  if (extended.status) details.push(String(extended.status));
  if (extended.cause) details.push(...errorDetails(extended.cause, seen));
  if (Array.isArray(extended.errors)) {
    for (const nestedError of extended.errors) details.push(...errorDetails(nestedError, seen));
  }
  return details;
}

export type ProviderErrorKind =
  | "not-configured"
  | "authentication"
  | "credits"
  | "busy"
  | "aborted"
  | "invalid-request"
  | "unknown";

export function classifyProviderError(error: unknown): ProviderErrorKind {
  if (error instanceof AssistantNotConfiguredError) return "not-configured";
  if (error instanceof Error && error.name === "AbortError") return "aborted";

  const detail = errorDetails(error).join(" ").toLowerCase();
  if (/\b(401|403)\b|api[ -]?key|unauthori[sz]ed|authentication/.test(detail)) {
    return "authentication";
  }
  if (/\b402\b|credit|payment required|insufficient balance|quota/.test(detail)) return "credits";
  if (/\b(408|409|425|429|500|502|503|504)\b|rate.?limit|timeout|timed out|overload|capacity|temporar/.test(detail)) {
    return "busy";
  }
  if (/\b400\b|invalid (request|prompt)|context length|too many tokens/.test(detail)) {
    return "invalid-request";
  }
  return "unknown";
}

export function providerErrorMessage(error: unknown) {
  switch (classifyProviderError(error)) {
    case "not-configured":
      return "Agent isn't configured yet. Add a model provider API key to continue.";
    case "authentication":
      return "Agent configuration needs attention. Please contact your workspace administrator.";
    case "credits":
      return "Every configured model provider is out of quota. Please contact your workspace administrator.";
    case "busy":
      return "The model providers are busy right now. The Agent retried automatically; please try again in a moment.";
    case "aborted":
      return "The response was stopped before it finished.";
    case "invalid-request":
      return "The model could not process this request. Try shortening the conversation or starting a new chat.";
    default:
      return "The Agent could not complete this response after trying every configured provider. Please try again.";
  }
}
