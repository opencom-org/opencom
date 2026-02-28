import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("ai", () => ({
  generateText: vi.fn(),
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: vi.fn(() => {
    return (_model: string) => ({});
  }),
}));

import { generateText } from "ai";
import { generateResponse, getAIConfigurationDiagnostic } from "../convex/aiAgentActions";

const mockGenerateText = vi.mocked(generateText);

describe("aiAgentActions runtime safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_GATEWAY_API_KEY = "test-ai-key";
  });

  it("returns explicit diagnostics for invalid runtime configuration", () => {
    expect(getAIConfigurationDiagnostic("")).toMatchObject({
      code: "MISSING_MODEL",
    });
    expect(getAIConfigurationDiagnostic("invalid-model-format")).toMatchObject({
      code: "INVALID_MODEL_FORMAT",
    });
    expect(getAIConfigurationDiagnostic("anthropic/claude-3-5-sonnet")).toMatchObject({
      code: "UNSUPPORTED_PROVIDER",
      provider: "anthropic",
    });
  });

  it("falls back to handoff and records diagnostics when configuration is invalid", async () => {
    const runQuery = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if ("query" in args) {
        return [];
      }
      if ("workspaceId" in args && "conversationId" in args === false) {
        return {
          enabled: true,
          model: "invalid-model-format",
          confidenceThreshold: 0.6,
          knowledgeSources: ["articles"],
          personality: null,
        };
      }
      return {
        conversationId: "conversation_1",
        workspaceId: "workspace_1",
        visitorId: "visitor_1",
      };
    });

    const runMutation = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if ("code" in args) {
        return "diagnostic_record_id";
      }
      if ("reason" in args) {
        return {
          messageId: "handoff_message_1",
          handoffMessage: "Routing you to a human agent.",
        };
      }
      throw new Error(`Unexpected mutation args: ${JSON.stringify(args)}`);
    });

    const result = await generateResponse._handler(
      {
        runQuery,
        runMutation,
      } as any,
      {
        workspaceId: "workspace_1" as any,
        conversationId: "conversation_1" as any,
        query: "Can you help me?",
      }
    );

    expect(result.handoff).toBe(true);
    expect(result.handoffReason).toMatch(/model format is invalid/i);
    expect(result.messageId).toBe("handoff_message_1");
    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workspaceId: "workspace_1",
        code: "INVALID_MODEL_FORMAT",
      })
    );
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("hands off with a visible message when AI agent is disabled", async () => {
    const runQuery = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if ("workspaceId" in args && "conversationId" in args === false) {
        return {
          enabled: false,
          model: "openai/gpt-5-nano",
          confidenceThreshold: 0.6,
          knowledgeSources: ["articles"],
          personality: null,
        };
      }
      return {
        conversationId: "conversation_1",
        workspaceId: "workspace_1",
        visitorId: "visitor_1",
      };
    });

    const runMutation = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if ("reason" in args) {
        return {
          messageId: "handoff_disabled_1",
          handoffMessage: "Routing you to a human agent.",
        };
      }
      throw new Error(`Unexpected mutation args: ${JSON.stringify(args)}`);
    });

    const result = await generateResponse._handler(
      {
        runQuery,
        runMutation,
      } as any,
      {
        workspaceId: "workspace_1" as any,
        conversationId: "conversation_1" as any,
        query: "Can you help me?",
      }
    );

    expect(result.handoff).toBe(true);
    expect(result.handoffReason).toBe("AI Agent is disabled");
    expect(result.messageId).toBe("handoff_disabled_1");
    expect(result.response).toBe("Routing you to a human agent.");
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("clears prior diagnostics and continues generation when configuration is valid", async () => {
    mockGenerateText.mockResolvedValue({
      text: "Here is the answer.",
      usage: { totalTokens: 42 },
    } as any);

    const runQuery = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if ("query" in args) {
        return [];
      }
      if ("workspaceId" in args && "conversationId" in args === false) {
        return {
          enabled: true,
          model: "openai/gpt-5-nano",
          confidenceThreshold: 0.2,
          knowledgeSources: ["articles"],
          personality: null,
        };
      }
      return {
        conversationId: "conversation_1",
        workspaceId: "workspace_1",
        visitorId: "visitor_1",
      };
    });

    const runMutation = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if (Object.keys(args).length === 1 && "workspaceId" in args) {
        return "cleared";
      }
      if ("senderId" in args && "content" in args) {
        return "ai_message_1";
      }
      if ("query" in args && "response" in args) {
        return "ai_response_1";
      }
      if ("reason" in args) {
        return {
          messageId: "handoff_message_1",
          handoffMessage: "Routing you to a human agent.",
        };
      }
      throw new Error(`Unexpected mutation args: ${JSON.stringify(args)}`);
    });

    const result = await generateResponse._handler(
      {
        runQuery,
        runMutation,
      } as any,
      {
        workspaceId: "workspace_1" as any,
        conversationId: "conversation_1" as any,
        query: "How do I update my profile?",
      }
    );

    expect(result.handoff).toBe(false);
    expect(result.messageId).toBe("ai_message_1");
    expect(runMutation).toHaveBeenCalledWith(expect.anything(), {
      workspaceId: "workspace_1",
    });
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it("retries once when first generation returns empty text and succeeds on retry", async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: "  ",
        finishReason: "stop",
        rawFinishReason: "stop",
        usage: {
          totalTokens: 20,
          outputTokens: 10,
          outputTokenDetails: { textTokens: 0, reasoningTokens: 10 },
        },
      } as any)
      .mockResolvedValueOnce({
        text: "You can start by creating an account and installing the widget script.",
        finishReason: "stop",
        rawFinishReason: "stop",
        usage: {
          totalTokens: 50,
          outputTokens: 30,
          outputTokenDetails: { textTokens: 30, reasoningTokens: 0 },
        },
      } as any);

    const runQuery = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if ("query" in args) {
        return [];
      }
      if ("workspaceId" in args && "conversationId" in args === false) {
        return {
          enabled: true,
          model: "openai/gpt-5-nano",
          confidenceThreshold: 0.2,
          knowledgeSources: ["articles"],
          personality: null,
        };
      }
      return {
        conversationId: "conversation_1",
        workspaceId: "workspace_1",
        visitorId: "visitor_1",
      };
    });

    const runMutation = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if (Object.keys(args).length === 1 && "workspaceId" in args) {
        return "cleared";
      }
      if ("senderId" in args && "content" in args) {
        return "ai_message_retry_1";
      }
      if ("query" in args && "response" in args) {
        return "ai_response_retry_1";
      }
      if ("reason" in args) {
        return {
          messageId: "handoff_message_1",
          handoffMessage: "Routing you to a human agent.",
        };
      }
      throw new Error(`Unexpected mutation args: ${JSON.stringify(args)}`);
    });

    const result = await generateResponse._handler(
      {
        runQuery,
        runMutation,
      } as any,
      {
        workspaceId: "workspace_1" as any,
        conversationId: "conversation_1" as any,
        query: "How do I get started?",
      }
    );

    expect(result.handoff).toBe(false);
    expect(result.messageId).toBe("ai_message_retry_1");
    expect(result.response).toContain("creating an account");
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: "How do I get started?",
        tokensUsed: 70,
      })
    );
    expect(runMutation).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        code: "EMPTY_GENERATION_RESPONSE",
      })
    );
  });

  it("persists a handoff message when generation fails", async () => {
    mockGenerateText.mockRejectedValue(new Error("gateway timeout"));

    const runQuery = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if ("query" in args) {
        return [];
      }
      if ("workspaceId" in args && "conversationId" in args === false) {
        return {
          enabled: true,
          model: "openai/gpt-5-nano",
          confidenceThreshold: 0.2,
          knowledgeSources: ["articles"],
          personality: null,
        };
      }
      return {
        conversationId: "conversation_1",
        workspaceId: "workspace_1",
        visitorId: "visitor_1",
      };
    });

    const runMutation = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if (Object.keys(args).length === 1 && "workspaceId" in args) {
        return "cleared";
      }
      if ("code" in args) {
        return "diagnostic_record_id";
      }
      if ("reason" in args) {
        return {
          messageId: "handoff_message_1",
          handoffMessage: "Routing you to a human agent.",
        };
      }
      if ("senderId" in args && "content" in args) {
        return "fallback_message_1";
      }
      throw new Error(`Unexpected mutation args: ${JSON.stringify(args)}`);
    });

    const result = await generateResponse._handler(
      {
        runQuery,
        runMutation,
      } as any,
      {
        workspaceId: "workspace_1" as any,
        conversationId: "conversation_1" as any,
        query: "How do I get started?",
      }
    );

    expect(result.handoff).toBe(true);
    expect(result.handoffReason).toBe("AI generation failed");
    expect(result.messageId).toBe("handoff_message_1");
    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workspaceId: "workspace_1",
        code: "GENERATION_FAILED",
      })
    );
  });

  it("falls back to a persisted bot message if handoff fails after generation error", async () => {
    mockGenerateText.mockRejectedValue(new Error("provider unavailable"));

    const runQuery = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if ("query" in args) {
        return [];
      }
      if ("workspaceId" in args && "conversationId" in args === false) {
        return {
          enabled: true,
          model: "openai/gpt-5-nano",
          confidenceThreshold: 0.2,
          knowledgeSources: ["articles"],
          personality: null,
        };
      }
      return {
        conversationId: "conversation_1",
        workspaceId: "workspace_1",
        visitorId: "visitor_1",
      };
    });

    const runMutation = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if (Object.keys(args).length === 1 && "workspaceId" in args) {
        return "cleared";
      }
      if ("code" in args) {
        return "diagnostic_record_id";
      }
      if ("reason" in args) {
        throw new Error("handoff unavailable");
      }
      if ("senderId" in args && "content" in args) {
        return "fallback_message_1";
      }
      throw new Error(`Unexpected mutation args: ${JSON.stringify(args)}`);
    });

    const result = await generateResponse._handler(
      {
        runQuery,
        runMutation,
      } as any,
      {
        workspaceId: "workspace_1" as any,
        conversationId: "conversation_1" as any,
        query: "Need help",
      }
    );

    expect(result.handoff).toBe(true);
    expect(result.messageId).toBe("fallback_message_1");
    expect(result.response).toMatch(/having trouble processing your request/i);
  });

  it("treats empty model output as a generation failure and hands off", async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        text: "   \n",
        finishReason: "stop",
        rawFinishReason: "stop",
        usage: {
          totalTokens: 24,
          outputTokens: 12,
          outputTokenDetails: { textTokens: 0, reasoningTokens: 12 },
        },
      } as any)
      .mockResolvedValueOnce({
        text: "\n",
        finishReason: "stop",
        rawFinishReason: "stop",
        usage: {
          totalTokens: 30,
          outputTokens: 14,
          outputTokenDetails: { textTokens: 0, reasoningTokens: 14 },
        },
      } as any);

    const runQuery = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if ("query" in args) {
        return [
          {
            type: "article",
            id: "article_1",
            title: "Getting Started",
            content: "Step one...",
            relevanceScore: 8,
          },
        ];
      }
      if ("workspaceId" in args && "conversationId" in args === false) {
        return {
          enabled: true,
          model: "openai/gpt-5-nano",
          confidenceThreshold: 0.2,
          knowledgeSources: ["articles"],
          personality: null,
        };
      }
      return {
        conversationId: "conversation_1",
        workspaceId: "workspace_1",
        visitorId: "visitor_1",
      };
    });

    const runMutation = vi.fn(async (_reference: unknown, args: Record<string, unknown>) => {
      if (Object.keys(args).length === 1 && "workspaceId" in args) {
        return "cleared";
      }
      if ("code" in args) {
        return "diagnostic_record_id";
      }
      if ("reason" in args) {
        return {
          messageId: "handoff_message_empty_1",
          handoffMessage: "Routing you to a human agent.",
        };
      }
      if ("senderId" in args && "content" in args) {
        return "fallback_message_1";
      }
      throw new Error(`Unexpected mutation args: ${JSON.stringify(args)}`);
    });

    const result = await generateResponse._handler(
      {
        runQuery,
        runMutation,
      } as any,
      {
        workspaceId: "workspace_1" as any,
        conversationId: "conversation_1" as any,
        query: "How do I get started?",
      }
    );

    expect(result.handoff).toBe(true);
    expect(result.handoffReason).toBe("AI returned an empty response");
    expect(result.messageId).toBe("handoff_message_empty_1");
    expect(mockGenerateText).toHaveBeenCalledTimes(2);
    expect(runMutation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        workspaceId: "workspace_1",
        code: "EMPTY_GENERATION_RESPONSE",
        message: expect.stringContaining("generationMetadata="),
      })
    );
    expect(runMutation).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: "How do I get started?",
      })
    );
  });

  it("rejects action execution when conversation workspace does not match request workspace", async () => {
    const runQuery = vi.fn(async (_reference: unknown, _args: Record<string, unknown>) => ({
      conversationId: "conversation_1",
      workspaceId: "workspace_other",
      visitorId: "visitor_1",
    }));

    const runMutation = vi.fn();

    await expect(
      generateResponse._handler(
        {
          runQuery,
          runMutation,
        } as any,
        {
          workspaceId: "workspace_1" as any,
          conversationId: "conversation_1" as any,
          query: "Need help",
        }
      )
    ).rejects.toThrow("Conversation does not belong to workspace");
    expect(runMutation).not.toHaveBeenCalled();
  });
});
