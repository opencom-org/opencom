import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import { AIAgentSection } from "./AIAgentSection";
import { useWebAction, useWebMutation, useWebQuery } from "@/lib/convex/hooks";

vi.mock("@/lib/convex/hooks", () => ({
  useWebAction: vi.fn(),
  useWebMutation: vi.fn(),
  useWebQuery: vi.fn(),
  webActionRef: vi.fn((functionName: string) => functionName),
  webMutationRef: vi.fn((functionName: string) => functionName),
  webQueryRef: vi.fn((functionName: string) => functionName),
}));

describe("AIAgentSection model discovery fallbacks", () => {
  const workspaceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as unknown as Id<"workspaces">;
  const aiSettingsFixture = {
    enabled: true,
    model: "openai/gpt-5-nano",
    confidenceThreshold: 0.6,
    knowledgeSources: ["articles"],
    personality: "",
    handoffMessage: "",
    suggestionsEnabled: false,
    embeddingModel: "text-embedding-3-small",
    lastConfigError: null,
  } as const;

  let listAvailableModelsMock: ReturnType<typeof vi.fn>;
  let rejectDiscovery: ((reason?: unknown) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    const mockedUseWebQuery = useWebQuery as unknown as ReturnType<typeof vi.fn>;
    mockedUseWebQuery.mockImplementation((_: unknown, args: unknown) => {
      if (args === "skip") {
        return undefined;
      }

      return aiSettingsFixture;
    });

    listAvailableModelsMock = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectDiscovery = reject;
        })
    );

    const mockedUseWebAction = useWebAction as unknown as ReturnType<typeof vi.fn>;
    mockedUseWebAction.mockReturnValue(listAvailableModelsMock);

    const mockedUseWebMutation = useWebMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseWebMutation.mockReturnValue(vi.fn().mockResolvedValue(undefined));
  });

  it("stops showing the loading placeholder when model discovery fails", async () => {
    render(<AIAgentSection workspaceId={workspaceId} />);

    await waitFor(() => {
      expect(listAvailableModelsMock).toHaveBeenCalledWith({
        workspaceId,
        selectedModel: aiSettingsFixture.model,
      });
    });

    expect(screen.getByRole("option", { name: /loading discovered models/i })).toBeInTheDocument();

    await act(async () => {
      rejectDiscovery?.(new Error("Discovery failed"));
    });

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /model discovery unavailable/i })).toBeInTheDocument();
    });

    expect(
      screen.getByText(/model discovery is currently unavailable\. enter a model id manually/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: /loading discovered models/i })
    ).not.toBeInTheDocument();
  });
});
