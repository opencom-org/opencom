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
