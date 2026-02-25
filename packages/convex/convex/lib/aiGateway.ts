import { createOpenAI } from "@ai-sdk/openai";

export function createAIClient() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY environment variable is not set");
  }

  const baseURL =
    process.env.AI_GATEWAY_BASE_URL ||
    (apiKey.startsWith("vck_") ? "https://ai-gateway.vercel.sh/v1" : "https://api.openai.com/v1");

  return createOpenAI({
    apiKey,
    baseURL,
  });
}
