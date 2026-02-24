import { describe, expect, it, vi } from "vitest";
import { getPublicSettings, getRuntimeSettingsForWorkspace } from "../convex/aiAgent";

function makeCtx(settings: Record<string, unknown> | null) {
  return {
    db: {
      query: vi.fn(() => ({
        withIndex: vi.fn((_name: string, _selector: unknown) => ({
          first: vi.fn(async () => settings),
        })),
      })),
    },
  } as any;
}

describe("aiAgent public/runtime settings queries", () => {
  it("returns widget-safe defaults when settings are missing", async () => {
    const result = await getPublicSettings._handler(makeCtx(null), {
      workspaceId: "workspace_1" as any,
    });

    expect(result.enabled).toBe(false);
    expect(result.model).toBe("openai/gpt-5-nano");
    expect(result.knowledgeSources).toEqual(["articles"]);
    expect(result.handoffMessage).toContain("human agent");
    expect("lastConfigError" in result).toBe(false);
  });

  it("normalizes optional runtime fields from stored settings", async () => {
    const storedSettings = {
      _id: "ai_settings_1",
      _creationTime: 1,
      workspaceId: "workspace_1",
      enabled: true,
      knowledgeSources: ["articles", "snippets"],
      confidenceThreshold: 0.7,
      model: "openai/gpt-5-nano",
      createdAt: 1,
      updatedAt: 2,
      personality: undefined,
      handoffMessage: undefined,
      workingHours: undefined,
      suggestionsEnabled: undefined,
      embeddingModel: undefined,
      lastConfigError: undefined,
    };

    const publicResult = await getPublicSettings._handler(makeCtx(storedSettings), {
      workspaceId: "workspace_1" as any,
    });
    expect(publicResult.enabled).toBe(true);
    expect(publicResult.handoffMessage).toContain("human agent");
    expect(publicResult.embeddingModel).toBe("text-embedding-3-small");
    expect(publicResult.personality).toBe(null);
    expect(publicResult.workingHours).toBe(null);

    const runtimeResult = await getRuntimeSettingsForWorkspace._handler(makeCtx(storedSettings), {
      workspaceId: "workspace_1" as any,
    });
    expect(runtimeResult.lastConfigError).toBeNull();
    expect(runtimeResult.suggestionsEnabled).toBe(false);
  });
});
