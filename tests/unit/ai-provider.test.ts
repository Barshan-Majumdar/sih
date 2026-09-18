import { describe, expect, it } from "vitest";
import {
  AssistantNotConfiguredError,
  classifyProviderError,
  openRouterProviderOptions,
  providerErrorMessage,
  shouldTryNextProvider,
} from "@/lib/ai-provider";

describe("provider fallback policy", () => {
  const busy = Object.assign(new Error("Upstream rate limit exceeded"), { statusCode: 429 });
  const unauthorized = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  const outOfCredit = Object.assign(new Error("Payment required"), { statusCode: 402 });

  it("falls through provider-local failures so the next key gets a turn", () => {
    expect(shouldTryNextProvider(busy, false)).toBe(true);
    expect(shouldTryNextProvider(unauthorized, false)).toBe(true);
    expect(shouldTryNextProvider(outOfCredit, false)).toBe(true);
  });

  it("stops on failures every provider would reject identically", () => {
    const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
    const malformed = Object.assign(new Error("Context length exceeded"), { status: 400 });
    expect(shouldTryNextProvider(aborted, false)).toBe(false);
    expect(shouldTryNextProvider(malformed, false)).toBe(false);
  });

  it("never falls through past the last provider", () => {
    expect(shouldTryNextProvider(busy, true)).toBe(false);
  });
});

describe("OpenRouter model-level options", () => {
  it("drops the primary and duplicates from the fallback list", () => {
    expect(
      openRouterProviderOptions(
        "google/gemini-primary",
        " openrouter/free, google/gemini-primary, meta/llama-fallback, openrouter/free "
      )
    ).toEqual({
      openrouter: {
        models: ["openrouter/free", "meta/llama-fallback"],
        provider: { allow_fallbacks: true },
      },
    });
  });

  it("omits the model list when the only fallback is the primary", () => {
    expect(openRouterProviderOptions("openrouter/free", "openrouter/free")).toEqual({
      openrouter: { provider: { allow_fallbacks: true } },
    });
  });
});

describe("OpenRouter errors", () => {
  it("finds retryable failures nested inside an exhausted retry error", () => {
    const rateLimit = Object.assign(new Error("Upstream rate limit exceeded"), { statusCode: 429 });
    const exhausted = Object.assign(new Error("Retries exhausted"), { errors: [rateLimit] });

    expect(classifyProviderError(exhausted)).toBe("busy");
    expect(providerErrorMessage(exhausted)).toMatch(/retried automatically/i);
  });

  it("does not describe authentication and credit failures as temporary", () => {
    expect(classifyProviderError(Object.assign(new Error("Unauthorized"), { statusCode: 401 }))).toBe(
      "authentication"
    );
    expect(classifyProviderError(Object.assign(new Error("Payment required"), { statusCode: 402 }))).toBe(
      "credits"
    );
  });

  it("provides a useful message when the Agent is not configured", () => {
    expect(providerErrorMessage(new AssistantNotConfiguredError("missing key"))).toMatch(
      /isn't configured yet/i
    );
  });

  it("distinguishes invalid requests from unknown provider failures", () => {
    expect(classifyProviderError(Object.assign(new Error("Context length exceeded"), { status: 400 }))).toBe(
      "invalid-request"
    );
    expect(classifyProviderError(new Error("Socket disappeared"))).toBe("unknown");
  });
});
