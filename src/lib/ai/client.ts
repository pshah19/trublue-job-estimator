import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = "claude-opus-5-5";

export function isAiAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY.trim());
}

let client: Anthropic | null = null;
export function getClient(): Anthropic {
  if (!client) client = new Anthropic({ timeout: 120_000, maxRetries: 2 });
  return client;
}

export function describeAiError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "Claude API key was rejected.";
  if (e instanceof Anthropic.RateLimitError) return "Claude API rate limit reached.";
  if (e instanceof Anthropic.APIConnectionError) return "Could not reach the Claude API.";
  if (e instanceof Anthropic.APIError) return `Claude API error (${e.status ?? "unknown"}).`;
  return e instanceof Error ? e.message : "Unknown AI error.";
}
