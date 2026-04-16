import { createOpenAI } from "@ai-sdk/openai";

const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_VERCEL_AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";
const GENERIC_PROVIDER_LABEL = "gateway";

function sanitizeProviderLabel(value: string): string {
  const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
  return sanitized || GENERIC_PROVIDER_LABEL;
}

export function getAIGatewayApiKey(): string | undefined {
  const apiKey = process.env.AI_GATEWAY_API_KEY?.trim();
  return apiKey && apiKey.length > 0 ? apiKey : undefined;
}

export function getAIBaseURL(apiKey = getAIGatewayApiKey()): string {
  const configuredBaseURL = process.env.AI_GATEWAY_BASE_URL?.trim();
  if (configuredBaseURL && configuredBaseURL.length > 0) {
    return configuredBaseURL.replace(/\/+$/, "");
  }

  return apiKey?.startsWith("vck_")
    ? DEFAULT_VERCEL_AI_GATEWAY_BASE_URL
    : DEFAULT_OPENAI_BASE_URL;
}

export function getAIGatewayProviderLabel(baseURL = getAIBaseURL()): string {
  try {
    const hostname = new URL(baseURL).hostname.toLowerCase();
    if (hostname === "api.openai.com" || hostname.endsWith(".openai.com")) {
      return "openai";
    }
    if (hostname === "ai-gateway.vercel.sh") {
      return GENERIC_PROVIDER_LABEL;
    }

    const segments = hostname
      .split(".")
      .filter(Boolean)
      .filter((segment) => !["api", "chat", "www", "gateway"].includes(segment));

    if (segments.length >= 2 && segments[segments.length - 1] === "ai") {
      const providerRoot = segments[segments.length - 2] ?? "";
      if (providerRoot.length === 1) {
        return sanitizeProviderLabel(`${providerRoot}ai`);
      }
    }

    for (let index = segments.length - 1; index >= 0; index -= 1) {
      const segment = segments[index];
      if (!segment || ["com", "ai", "net", "dev", "app", "io", "sh", "co"].includes(segment)) {
        continue;
      }
      return sanitizeProviderLabel(segment);
    }
  } catch {
    return GENERIC_PROVIDER_LABEL;
  }

  return GENERIC_PROVIDER_LABEL;
}

export function createAIClient() {
  const apiKey = getAIGatewayApiKey();
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY environment variable is not set");
  }

  return createOpenAI({
    apiKey,
    baseURL: getAIBaseURL(apiKey),
  });
}
