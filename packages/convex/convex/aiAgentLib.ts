import { createOpenAI } from "@ai-sdk/openai";

export function createAIClient() {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new Error("AI_GATEWAY_API_KEY is not set");
  }
  return createOpenAI({
    apiKey,
  });
}
