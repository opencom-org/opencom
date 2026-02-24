"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

type AIConfigurationDiagnostic = {
  code: string;
  message: string;
  provider?: string;
  model?: string;
};

const SUPPORTED_AI_PROVIDERS = new Set(["openai"]);

// Create AI Gateway client
const createAIClient = () => {
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
};

// Parse model string to get provider and model name
export const parseModel = (modelString: string): { provider: string; model: string } => {
  const parts = modelString.split("/");
  if (parts.length === 2) {
    return { provider: parts[0], model: parts[1] };
  }
  return { provider: "openai", model: modelString };
};

export const getAIConfigurationDiagnostic = (
  modelString: string,
  environment: { aiGatewayApiKey?: string } = {
    aiGatewayApiKey: process.env.AI_GATEWAY_API_KEY,
  }
): AIConfigurationDiagnostic | null => {
  const trimmedModel = modelString.trim();
  if (!trimmedModel) {
    return {
      code: "MISSING_MODEL",
      message: "AI model is not configured. Update AI Agent settings.",
    };
  }

  const parts = trimmedModel.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return {
      code: "INVALID_MODEL_FORMAT",
      message: "AI model format is invalid. Use provider/model (for example openai/gpt-5-nano).",
      model: trimmedModel,
    };
  }

  const provider = parts[0];
  if (!SUPPORTED_AI_PROVIDERS.has(provider)) {
    return {
      code: "UNSUPPORTED_PROVIDER",
      message: `Provider '${provider}' is not supported in this runtime.`,
      provider,
      model: trimmedModel,
    };
  }

  if (!environment.aiGatewayApiKey) {
    return {
      code: "MISSING_PROVIDER_CREDENTIALS",
      message: "AI provider credentials are missing. Set AI_GATEWAY_API_KEY.",
      provider,
      model: trimmedModel,
    };
  }

  return null;
};

// Build system prompt for AI Agent
const buildSystemPrompt = (personality: string | null, knowledgeContext: string): string => {
  const basePrompt = `You are a helpful customer support AI assistant. Your role is to answer customer questions accurately and helpfully using the provided knowledge base content.

IMPORTANT GUIDELINES:
1. Only answer questions using the information provided in the KNOWLEDGE CONTEXT below
2. If you cannot find relevant information to answer the question, say "I don't have enough information to answer that question. Let me connect you with a human agent."
3. Be concise but thorough in your responses
4. Always be polite and professional
5. If the customer seems frustrated or asks to speak to a human, acknowledge their request
6. Cite your sources when possible by mentioning the article or document title
7. Never make up information that isn't in the knowledge context

${personality ? `PERSONALITY: ${personality}\n` : ""}
KNOWLEDGE CONTEXT:
${knowledgeContext}

If the knowledge context is empty or doesn't contain relevant information, politely explain that you don't have the information and offer to connect them with a human agent.`;

  return basePrompt;
};

// Calculate confidence score based on response and context
const calculateConfidence = (
  response: string,
  knowledgeResults: Array<{ relevanceScore: number }>,
  _query: string
): number => {
  let confidence = 0.5; // Base confidence

  // Boost confidence if we have relevant knowledge
  if (knowledgeResults.length > 0) {
    const avgRelevance =
      knowledgeResults.reduce((sum, r) => sum + r.relevanceScore, 0) / knowledgeResults.length;
    confidence += Math.min(avgRelevance / 20, 0.3); // Max 0.3 boost from relevance
  }

  // Lower confidence if response contains uncertainty phrases
  const uncertaintyPhrases = [
    "i don't know",
    "i'm not sure",
    "i cannot find",
    "i don't have enough information",
    "let me connect you",
    "human agent",
  ];

  const lowerResponse = response.toLowerCase();
  for (const phrase of uncertaintyPhrases) {
    if (lowerResponse.includes(phrase)) {
      confidence -= 0.2;
      break;
    }
  }

  // Ensure confidence is between 0 and 1
  return Math.max(0, Math.min(1, confidence));
};

// Detect if handoff is needed
const shouldHandoff = (
  response: string,
  confidence: number,
  threshold: number,
  query: string
): { handoff: boolean; reason: string | null } => {
  // Check confidence threshold
  if (confidence < threshold) {
    return { handoff: true, reason: "Low confidence response" };
  }

  // Check for explicit handoff requests in query
  const handoffPhrases = [
    "talk to human",
    "speak to agent",
    "real person",
    "human agent",
    "talk to someone",
    "speak to someone",
    "customer service",
    "representative",
  ];

  const lowerQuery = query.toLowerCase();
  for (const phrase of handoffPhrases) {
    if (lowerQuery.includes(phrase)) {
      return { handoff: true, reason: "Customer requested human agent" };
    }
  }

  // Check for sensitive topics
  const sensitivePhrases = [
    "billing",
    "refund",
    "cancel subscription",
    "delete account",
    "complaint",
    "legal",
    "lawsuit",
  ];

  for (const phrase of sensitivePhrases) {
    if (lowerQuery.includes(phrase)) {
      return { handoff: true, reason: "Sensitive topic detected" };
    }
  }

  // Check if AI response indicates it can't help
  const lowerResponse = response.toLowerCase();
  if (lowerResponse.includes("let me connect you") || lowerResponse.includes("human agent")) {
    return { handoff: true, reason: "AI indicated handoff needed" };
  }

  return { handoff: false, reason: null };
};

// Generate AI response action
export const generateResponse = action({
  args: {
    workspaceId: v.id("workspaces"),
    conversationId: v.id("conversations"),
    visitorId: v.optional(v.id("visitors")),
    sessionToken: v.optional(v.string()),
    query: v.string(),
    conversationHistory: v.optional(
      v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      )
    ),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    response: string;
    confidence: number;
    sources: Array<{ type: string; id: string; title: string }>;
    handoff: boolean;
    handoffReason: string | null;
    messageId: string | null;
  }> => {
    const startTime = Date.now();

    const access = await ctx.runQuery(internal.aiAgent.authorizeConversationAccess, {
      conversationId: args.conversationId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    });
    if (access.workspaceId !== args.workspaceId) {
      throw new Error("Conversation does not belong to workspace");
    }

    // Get AI settings
    const settings = await ctx.runQuery(internal.aiAgent.getRuntimeSettingsForWorkspace, {
      workspaceId: args.workspaceId,
    });

    if (!settings.enabled) {
      return {
        response: "",
        confidence: 0,
        sources: [],
        handoff: true,
        handoffReason: "AI Agent is disabled",
        messageId: null,
      };
    }

    const configurationDiagnostic = getAIConfigurationDiagnostic(settings.model);
    if (configurationDiagnostic) {
      await ctx.runMutation(internal.aiAgent.recordRuntimeDiagnostic, {
        workspaceId: args.workspaceId,
        code: configurationDiagnostic.code,
        message: configurationDiagnostic.message,
        provider: configurationDiagnostic.provider,
        model: configurationDiagnostic.model,
      });

      const handoff = await ctx.runMutation(api.aiAgent.handoffToHuman, {
        conversationId: args.conversationId,
        visitorId: args.visitorId,
        sessionToken: args.sessionToken,
        reason: configurationDiagnostic.message,
      });

      return {
        response: handoff.handoffMessage,
        confidence: 0,
        sources: [],
        handoff: true,
        handoffReason: configurationDiagnostic.message,
        messageId: handoff.messageId,
      };
    }

    await ctx.runMutation(internal.aiAgent.clearRuntimeDiagnostic, {
      workspaceId: args.workspaceId,
    });

    // Get relevant knowledge
    const knowledgeResults = await ctx.runQuery(internal.aiAgent.getRelevantKnowledgeForRuntime, {
      workspaceId: args.workspaceId,
      query: args.query,
      knowledgeSources: settings.knowledgeSources as Array<
        "articles" | "internalArticles" | "snippets"
      >,
      limit: 5,
    });

    // Build knowledge context for prompt
    const knowledgeContext = knowledgeResults
      .map(
        (r: { title: string; content: string }, i: number) =>
          `[Source ${i + 1}: ${r.title}]\n${r.content.slice(0, 2000)}${r.content.length > 2000 ? "..." : ""}`
      )
      .join("\n\n---\n\n");

    // Build system prompt
    const systemPrompt = buildSystemPrompt(
      settings.personality ?? null,
      knowledgeContext || "No relevant knowledge found."
    );

    // Parse model configuration
    const { provider, model } = parseModel(settings.model);

    // Generate response using Vercel AI SDK
    let responseText: string;
    let tokensUsed: number | undefined;

    try {
      const aiClient = createAIClient();

      const messages: Array<{ role: "user" | "assistant"; content: string }> = [
        ...(args.conversationHistory || []),
        { role: "user" as const, content: args.query },
      ];

      const result = await generateText({
        model: aiClient(model),
        system: systemPrompt,
        messages,
        maxOutputTokens: 1000,
        temperature: 0.7,
      });

      responseText = result.text;
      tokensUsed = result.usage?.totalTokens;
    } catch (error) {
      console.error("AI generation error:", error);
      const reason = "AI generation failed";
      const errorMessage = error instanceof Error ? error.message : "Unknown generation error";

      try {
        await ctx.runMutation(internal.aiAgent.recordRuntimeDiagnostic, {
          workspaceId: args.workspaceId,
          code: "GENERATION_FAILED",
          message: `AI generation failed: ${errorMessage}`,
          provider,
          model: settings.model,
        });
      } catch (diagnosticError) {
        console.error("Failed to record AI runtime diagnostic:", diagnosticError);
      }

      try {
        const handoff = await ctx.runMutation(api.aiAgent.handoffToHuman, {
          conversationId: args.conversationId,
          visitorId: args.visitorId,
          sessionToken: args.sessionToken,
          reason,
        });

        return {
          response: handoff.handoffMessage,
          confidence: 0,
          sources: [],
          handoff: true,
          handoffReason: reason,
          messageId: handoff.messageId,
        };
      } catch (handoffError) {
        console.error("Failed to handoff after AI generation error:", handoffError);
      }

      const fallbackResponse =
        "I'm having trouble processing your request right now. Let me connect you with a human agent.";
      const messageId = await ctx.runMutation(internal.messages.internalSendBotMessage, {
        conversationId: args.conversationId,
        senderId: "ai-agent",
        content: fallbackResponse,
      });

      return {
        response: fallbackResponse,
        confidence: 0,
        sources: [],
        handoff: true,
        handoffReason: reason,
        messageId,
      };
    }

    const generationTimeMs = Date.now() - startTime;

    // Calculate confidence
    const confidence = calculateConfidence(responseText, knowledgeResults, args.query);

    // Check if handoff is needed
    const { handoff, reason: handoffReason } = shouldHandoff(
      responseText,
      confidence,
      settings.confidenceThreshold,
      args.query
    );

    // Prepare sources
    const sources = knowledgeResults.map((r: { type: string; id: string; title: string }) => ({
      type: r.type,
      id: r.id,
      title: r.title,
    }));

    // Create the AI message via the internal bot-only path.
    const messageId = await ctx.runMutation(internal.messages.internalSendBotMessage, {
      conversationId: args.conversationId,
      senderId: "ai-agent",
      content: responseText,
    });

    // Store the AI response for analytics
    await ctx.runMutation(api.aiAgent.storeResponse, {
      conversationId: args.conversationId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
      messageId,
      query: args.query,
      response: responseText,
      sources,
      confidence,
      handedOff: handoff,
      handoffReason: handoffReason ?? undefined,
      generationTimeMs,
      tokensUsed,
      model: settings.model,
      provider,
    });

    // If handoff is needed, trigger it
    if (handoff) {
      await ctx.runMutation(api.aiAgent.handoffToHuman, {
        conversationId: args.conversationId,
        visitorId: args.visitorId,
        sessionToken: args.sessionToken,
        reason: handoffReason ?? undefined,
      });
    }

    return {
      response: responseText,
      confidence,
      sources,
      handoff,
      handoffReason,
      messageId,
    };
  },
});
