"use node";

import { anyApi } from "convex/server";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { generateText } from "ai";
import { createAIClient } from "./lib/aiGateway";

type AIConfigurationDiagnostic = {
  code: string;
  message: string;
  provider?: string;
  model?: string;
};

const SUPPORTED_AI_PROVIDERS = new Set(["openai"]);
const GENERATION_FAILURE_FALLBACK_RESPONSE =
  "I'm having trouble processing your request right now. Let me connect you with a human agent.";
const EMPTY_RESPONSE_RETRY_LIMIT = 1;
const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 2000;
const DEFAULT_MAX_OUTPUT_TOKENS = 2000;
const GPT5_REASONING_MAX_OUTPUT_TOKENS = 10000;

const supportsTemperatureControl = (provider: string, model: string): boolean => {
  // OpenAI GPT-5 reasoning models reject temperature and emit warnings.
  if (provider === "openai" && model.toLowerCase().startsWith("gpt-5")) {
    return false;
  }
  return true;
};

const isGPT5ReasoningModel = (provider: string, model: string): boolean =>
  provider === "openai" && model.toLowerCase().startsWith("gpt-5");

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

const truncateDiagnosticMessage = (value: string): string =>
  value.length > MAX_DIAGNOSTIC_MESSAGE_LENGTH
    ? `${value.slice(0, MAX_DIAGNOSTIC_MESSAGE_LENGTH)}...`
    : value;

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
8. Respond in plain text with at least one complete sentence
9. Never return an empty or whitespace-only response
10. Do not suggest connecting to a human agent if you already provided a complete, relevant answer

${personality ? `PERSONALITY: ${personality}\n` : ""}
KNOWLEDGE CONTEXT:
${knowledgeContext}

Only suggest human handoff when: (a) the customer explicitly asks for a human, or (b) the knowledge context is not sufficient to answer accurately. Do not append a handoff offer to otherwise resolved answers.`;

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
  const mentionsHumanEscalation =
    lowerResponse.includes("let me connect you") ||
    lowerResponse.includes("human agent") ||
    lowerResponse.includes("talk to a human") ||
    lowerResponse.includes("speak to a human");
  const indicatesCannotResolve =
    lowerResponse.includes("i don't have enough information") ||
    lowerResponse.includes("i do not have enough information") ||
    lowerResponse.includes("i cannot find") ||
    lowerResponse.includes("i can't find") ||
    lowerResponse.includes("i'm not sure") ||
    lowerResponse.includes("i am not sure") ||
    lowerResponse.includes("i don't know") ||
    lowerResponse.includes("i do not know");
  if (mentionsHumanEscalation && indicatesCannotResolve) {
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
    sources: Array<{ type: string; id: string; title: string; articleId?: string }>;
    handoff: boolean;
    handoffReason: string | null;
    messageId: string | null;
  }> => {
    const startTime = Date.now();

    const runQuery = ctx.runQuery as unknown as (
      queryRef: unknown,
      queryArgs: Record<string, unknown>
    ) => Promise<unknown>;
    const runMutation = ctx.runMutation as unknown as (
      mutationRef: unknown,
      mutationArgs: Record<string, unknown>
    ) => Promise<unknown>;
    const unsafeInternalApi = anyApi as unknown as {
      aiAgent: {
        authorizeConversationAccess: unknown;
        getRuntimeSettingsForWorkspace: unknown;
        recordRuntimeDiagnostic: unknown;
        clearRuntimeDiagnostic: unknown;
        getRelevantKnowledgeForRuntime: unknown;
      };
      messages: { internalSendBotMessage: unknown };
    };
    const unsafeApi = anyApi as unknown as {
      aiAgent: { handoffToHuman: unknown; storeResponse: unknown };
    };
    const authorizeConversationAccessRef = unsafeInternalApi.aiAgent.authorizeConversationAccess;
    const getRuntimeSettingsForWorkspaceRef = unsafeInternalApi.aiAgent.getRuntimeSettingsForWorkspace;
    const recordRuntimeDiagnosticRef = unsafeInternalApi.aiAgent.recordRuntimeDiagnostic;
    const clearRuntimeDiagnosticRef = unsafeInternalApi.aiAgent.clearRuntimeDiagnostic;
    const getRelevantKnowledgeForRuntimeRef = unsafeInternalApi.aiAgent.getRelevantKnowledgeForRuntime;
    const internalSendBotMessageRef = unsafeInternalApi.messages.internalSendBotMessage;
    const handoffToHumanRef = unsafeApi.aiAgent.handoffToHuman;
    const storeResponseRef = unsafeApi.aiAgent.storeResponse;

    const access = (await runQuery(authorizeConversationAccessRef, {
      conversationId: args.conversationId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
    })) as {
      workspaceId: string;
      aiWorkflowState?: string | null;
      hasHumanAgentResponse?: boolean;
    };
    if (access.workspaceId !== args.workspaceId) {
      throw new Error("Conversation does not belong to workspace");
    }

    const suppressionReason =
      access.aiWorkflowState === "handoff"
        ? "Conversation has already been handed off to a human agent"
        : access.hasHumanAgentResponse
          ? "A human agent has already responded in this conversation"
          : null;
    if (suppressionReason) {
      return {
        response: "",
        confidence: 0,
        sources: [],
        handoff: true,
        handoffReason: suppressionReason,
        messageId: null,
      };
    }

    // Get AI settings
    const settings = (await runQuery(getRuntimeSettingsForWorkspaceRef, {
      workspaceId: args.workspaceId,
    })) as {
      enabled: boolean;
      model: string;
      knowledgeSources?: Array<"articles" | "internalArticles" | "snippets">;
      personality?: string | null;
      confidenceThreshold?: number;
    };

    if (!settings.enabled) {
      const reason = "AI Agent is disabled";
      try {
        const handoff = (await runMutation(handoffToHumanRef, {
          conversationId: args.conversationId,
          visitorId: args.visitorId,
          sessionToken: args.sessionToken,
          reason,
        })) as {
          handoffMessage: string;
          messageId: string | null;
        };

        return {
          response: handoff.handoffMessage,
          confidence: 0,
          sources: [],
          handoff: true,
          handoffReason: reason,
          messageId: handoff.messageId,
        };
      } catch (handoffError) {
        console.error("Failed to handoff when AI Agent is disabled:", handoffError);
      }

      const messageId = (await runMutation(internalSendBotMessageRef, {
        conversationId: args.conversationId,
        senderId: "ai-agent",
        content: GENERATION_FAILURE_FALLBACK_RESPONSE,
      })) as string;

      return {
        response: GENERATION_FAILURE_FALLBACK_RESPONSE,
        confidence: 0,
        sources: [],
        handoff: true,
        handoffReason: reason,
        messageId,
      };
    }

    const configurationDiagnostic = getAIConfigurationDiagnostic(settings.model);
    if (configurationDiagnostic) {
      await runMutation(recordRuntimeDiagnosticRef, {
        workspaceId: args.workspaceId,
        code: configurationDiagnostic.code,
        message: configurationDiagnostic.message,
        provider: configurationDiagnostic.provider,
        model: configurationDiagnostic.model,
      });

      const handoff = (await runMutation(handoffToHumanRef, {
        conversationId: args.conversationId,
        visitorId: args.visitorId,
        sessionToken: args.sessionToken,
        reason: configurationDiagnostic.message,
      })) as {
        handoffMessage: string;
        messageId: string | null;
      };

      return {
        response: handoff.handoffMessage,
        confidence: 0,
        sources: [],
        handoff: true,
        handoffReason: configurationDiagnostic.message,
        messageId: handoff.messageId,
      };
    }

    await runMutation(clearRuntimeDiagnosticRef, {
      workspaceId: args.workspaceId,
    });

    // Get relevant knowledge
    const knowledgeResults = (await runQuery(getRelevantKnowledgeForRuntimeRef, {
      workspaceId: args.workspaceId,
      query: args.query,
      knowledgeSources: settings.knowledgeSources as Array<
        "articles" | "internalArticles" | "snippets"
      >,
      limit: 5,
    })) as Array<{
      type: string;
      id: string;
      title: string;
      content: string;
      relevanceScore: number;
    }>;

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

    const handleGenerationFailure = async (
      reason: string,
      diagnosticCode: string,
      diagnosticMessage: string
    ) => {
      const generationTimeMs = Date.now() - startTime;

      try {
        await runMutation(recordRuntimeDiagnosticRef, {
          workspaceId: args.workspaceId,
          code: diagnosticCode,
          message: diagnosticMessage,
          provider,
          model: settings.model,
        });
      } catch (diagnosticError) {
        console.error("Failed to record AI runtime diagnostic:", diagnosticError);
      }

      try {
        const handoff = (await runMutation(handoffToHumanRef, {
          conversationId: args.conversationId,
          visitorId: args.visitorId,
          sessionToken: args.sessionToken,
          reason,
        })) as { handoffMessage: string; messageId: string | null };

        try {
          await runMutation(storeResponseRef, {
            conversationId: args.conversationId,
            visitorId: args.visitorId,
            sessionToken: args.sessionToken,
            messageId: handoff.messageId,
            query: args.query,
            response: handoff.handoffMessage,
            sources: [],
            confidence: 0,
            handedOff: true,
            handoffReason: reason,
            generationTimeMs,
            tokensUsed,
            model: settings.model,
            provider,
          });
        } catch (persistenceError) {
          console.error(
            "Failed to persist AI response metadata after generation failure handoff:",
            persistenceError
          );
        }

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

      const messageId = (await runMutation(internalSendBotMessageRef, {
        conversationId: args.conversationId,
        senderId: "ai-agent",
        content: GENERATION_FAILURE_FALLBACK_RESPONSE,
      })) as string;

      try {
        await runMutation(storeResponseRef, {
          conversationId: args.conversationId,
          visitorId: args.visitorId,
          sessionToken: args.sessionToken,
          messageId,
          query: args.query,
          response: GENERATION_FAILURE_FALLBACK_RESPONSE,
          sources: [],
          confidence: 0,
          handedOff: true,
          handoffReason: reason,
          generationTimeMs,
          tokensUsed,
          model: settings.model,
          provider,
        });
      } catch (persistenceError) {
        console.error(
          "Failed to persist AI response metadata after fallback message persistence:",
          persistenceError
        );
      }

      return {
        response: GENERATION_FAILURE_FALLBACK_RESPONSE,
        confidence: 0,
        sources: [],
        handoff: true,
        handoffReason: reason,
        messageId,
      };
    };

    const aiClient = createAIClient();
    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      ...(args.conversationHistory || []),
      { role: "user" as const, content: args.query },
    ];

    const generationAttempts: Array<Record<string, unknown>> = [];

    const attemptGeneration = async (attempt: number, retryingAfterEmptyResponse: boolean) => {
      const retrySuffix = retryingAfterEmptyResponse
        ? "\n\nRETRY INSTRUCTION: Your first attempt returned empty text. Respond now with at least one complete plain-text sentence."
        : "";
      const useReasoningProfile = isGPT5ReasoningModel(provider, model);
      const maxOutputTokens = useReasoningProfile
        ? GPT5_REASONING_MAX_OUTPUT_TOKENS
        : DEFAULT_MAX_OUTPUT_TOKENS;

      const result = await generateText({
        model: aiClient(model),
        system: `${systemPrompt}${retrySuffix}`,
        messages,
        maxOutputTokens,
        ...(useReasoningProfile
          ? {
              providerOptions: {
                openai: {
                  // Allocate a larger completion budget so reasoning models still emit text.
                  maxCompletionTokens: maxOutputTokens,
                  reasoningEffort: retryingAfterEmptyResponse ? "minimal" : "high",
                  textVerbosity: retryingAfterEmptyResponse ? "high" : "medium",
                },
              },
            }
          : {}),
        ...(supportsTemperatureControl(provider, model)
          ? { temperature: retryingAfterEmptyResponse ? 0.2 : 0.7 }
          : {}),
      });

      const responseText = (result.text ?? "").trim();
      const warnings = (result.warnings ?? []).map((warning) => {
        if (typeof warning === "string") {
          return warning;
        }
        try {
          return JSON.stringify(warning);
        } catch (_error) {
          return String(warning);
        }
      });
      const usage = result.usage;

      generationAttempts.push({
        attempt,
        retryingAfterEmptyResponse,
        textLength: responseText.length,
        finishReason: result.finishReason,
        rawFinishReason: result.rawFinishReason,
        outputTokens: usage?.outputTokens,
        outputTextTokens: usage?.outputTokenDetails?.textTokens,
        outputReasoningTokens: usage?.outputTokenDetails?.reasoningTokens,
        totalTokens: usage?.totalTokens,
        warningCount: warnings.length,
        warnings: warnings.slice(0, 3),
        responseId: result.response?.id,
        responseModel: result.response?.modelId,
      });

      return {
        responseText,
        tokensUsed: usage?.totalTokens,
      };
    };

    const serializeGenerationAttempts = (): string =>
      truncateDiagnosticMessage(JSON.stringify({ attempts: generationAttempts }));

    // Generate response using Vercel AI SDK with one retry on empty text output.
    let responseText = "";
    let tokensUsed: number | undefined;

    try {
      const firstAttempt = await attemptGeneration(1, false);
      responseText = firstAttempt.responseText;
      tokensUsed = firstAttempt.tokensUsed;
    } catch (error) {
      console.error("AI generation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown generation error";
      return await handleGenerationFailure(
        "AI generation failed",
        "GENERATION_FAILED",
        truncateDiagnosticMessage(
          `AI generation failed: ${errorMessage}. generationMetadata=${serializeGenerationAttempts()}`
        )
      );
    }

    if (!responseText) {
      for (let retry = 0; retry < EMPTY_RESPONSE_RETRY_LIMIT && !responseText; retry++) {
        try {
          const retryAttempt = await attemptGeneration(retry + 2, true);
          responseText = retryAttempt.responseText;
          if (retryAttempt.tokensUsed !== undefined) {
            tokensUsed = (tokensUsed ?? 0) + retryAttempt.tokensUsed;
          }
        } catch (retryError) {
          console.error("AI empty-response retry failed:", retryError);
          const retryErrorMessage =
            retryError instanceof Error ? retryError.message : "Unknown retry generation error";
          return await handleGenerationFailure(
            "AI returned an empty response and retry failed",
            "EMPTY_RESPONSE_RETRY_FAILED",
            truncateDiagnosticMessage(
              `AI returned empty response and retry failed: ${retryErrorMessage}. generationMetadata=${serializeGenerationAttempts()}`
            )
          );
        }
      }
    }

    if (!responseText) {
      return await handleGenerationFailure(
        "AI returned an empty response",
        "EMPTY_GENERATION_RESPONSE",
        truncateDiagnosticMessage(
          `AI returned an empty response payload after retry. generationMetadata=${serializeGenerationAttempts()}`
        )
      );
    }

    const generationTimeMs = Date.now() - startTime;

    // Calculate confidence
    const confidence = calculateConfidence(responseText, knowledgeResults, args.query);

    // Check if handoff is needed
    const { handoff, reason: handoffReason } = shouldHandoff(
      responseText,
      confidence,
      settings.confidenceThreshold ?? 0.6,
      args.query
    );

    // Prepare sources
    const sources = knowledgeResults.map((r: { type: string; id: string; title: string }) => ({
      type: r.type,
      id: r.id,
      title: r.title,
      articleId: r.type === "article" ? r.id : undefined,
    }));

    if (handoff) {
      // Preserve both generated and delivered contexts while keeping one visitor-facing handoff message.
      const handoffResult = (await runMutation(handoffToHumanRef, {
        conversationId: args.conversationId,
        visitorId: args.visitorId,
        sessionToken: args.sessionToken,
        reason: handoffReason ?? undefined,
      })) as { handoffMessage: string; messageId: string | null };

      await runMutation(storeResponseRef, {
        conversationId: args.conversationId,
        visitorId: args.visitorId,
        sessionToken: args.sessionToken,
        messageId: handoffResult.messageId,
        query: args.query,
        response: handoffResult.handoffMessage,
        generatedCandidateResponse: responseText,
        generatedCandidateSources: sources,
        generatedCandidateConfidence: confidence,
        sources: [],
        confidence,
        handedOff: true,
        handoffReason: handoffReason ?? undefined,
        generationTimeMs,
        tokensUsed,
        model: settings.model,
        provider,
      });

      return {
        response: handoffResult.handoffMessage,
        confidence,
        sources: [],
        handoff: true,
        handoffReason,
        messageId: handoffResult.messageId,
      };
    }

    // Create the AI message via the internal bot-only path.
    const messageId = (await runMutation(internalSendBotMessageRef, {
      conversationId: args.conversationId,
      senderId: "ai-agent",
      content: responseText,
    })) as string;

    // Store the AI response for analytics
    await runMutation(storeResponseRef, {
      conversationId: args.conversationId,
      visitorId: args.visitorId,
      sessionToken: args.sessionToken,
      messageId,
      query: args.query,
      response: responseText,
      sources,
      confidence,
      handedOff: false,
      generationTimeMs,
      tokensUsed,
      model: settings.model,
      provider,
    });

    return {
      response: responseText,
      confidence,
      sources,
      handoff: false,
      handoffReason: null,
      messageId,
    };
  },
});
