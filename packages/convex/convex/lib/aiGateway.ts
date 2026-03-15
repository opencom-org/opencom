import { createOpenAI } from "@ai-sdk/openai";

export interface AIClientOptions {
  /**
   * Optional Stripe billing headers passed through to the Vercel AI Gateway.
   * When present, the gateway automatically emits per-request meter events to Stripe
   * for the `token-billing-tokens` billing meter (input + output tokens).
   *
   * Required headers:
   *   - `stripe-customer-id`: The Stripe customer ID for the workspace
   *   - `stripe-restricted-access-key`: A Stripe restricted key with meter event write permissions
   *
   * NOTE: Only include these headers for active paid subscriptions (not trials).
   * The AI Gateway handles missing headers gracefully (routes normally, no metering).
   */
  stripeHeaders?: Record<string, string>;
}

export function createAIClient(options?: AIClientOptions) {
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
    // Stripe billing headers are passed through to the Vercel AI Gateway for automatic
    // per-request token metering. Only present when the workspace has an active paid subscription.
    headers: options?.stripeHeaders,
  });
}
