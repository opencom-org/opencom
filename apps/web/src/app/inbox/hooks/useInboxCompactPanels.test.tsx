import { renderHook, act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import {
  shouldResetCompactPanelForViewport,
  shouldResetSuggestionsPanelForSidecar,
  useInboxCompactPanels,
} from "./useInboxCompactPanels";

function conversationId(value: string): Id<"conversations"> {
  return value as Id<"conversations">;
}

describe("useInboxCompactPanels", () => {
  it("exposes compact reset helper semantics", () => {
    expect(
      shouldResetCompactPanelForViewport({
        isCompactViewport: false,
        selectedConversationId: conversationId("conv-1"),
      })
    ).toBe(true);
    expect(
      shouldResetCompactPanelForViewport({
        isCompactViewport: true,
        selectedConversationId: null,
      })
    ).toBe(true);
    expect(
      shouldResetCompactPanelForViewport({
        isCompactViewport: true,
        selectedConversationId: conversationId("conv-1"),
      })
    ).toBe(false);
  });

  it("resets suggestions panel when sidecar is disabled", () => {
    expect(
      shouldResetSuggestionsPanelForSidecar({
        activeCompactPanel: "suggestions",
        isSidecarEnabled: false,
      })
    ).toBe(true);
    expect(
      shouldResetSuggestionsPanelForSidecar({
        activeCompactPanel: "ai-review",
        isSidecarEnabled: false,
      })
    ).toBe(false);
  });

  it("closes active compact panel when viewport or sidecar constraints change", () => {
    const focusReplyInput = vi.fn();
    const { result, rerender } = renderHook(
      (props: {
        isCompactViewport: boolean;
        selectedConversationId: Id<"conversations"> | null;
        isSidecarEnabled: boolean;
      }) =>
        useInboxCompactPanels({
          ...props,
          focusReplyInput,
        }),
      {
        initialProps: {
          isCompactViewport: true,
          selectedConversationId: conversationId("conv-1"),
          isSidecarEnabled: true,
        },
      }
    );

    act(() => {
      result.current.toggleAuxiliaryPanel("suggestions");
    });
    expect(result.current.activeCompactPanel).toBe("suggestions");
    expect(result.current.suggestionsPanelOpen).toBe(true);

    rerender({
      isCompactViewport: true,
      selectedConversationId: conversationId("conv-1"),
      isSidecarEnabled: false,
    });
    expect(result.current.activeCompactPanel).toBeNull();
    expect(result.current.suggestionsPanelOpen).toBe(false);

    act(() => {
      result.current.toggleAuxiliaryPanel("ai-review");
    });
    expect(result.current.activeCompactPanel).toBe("ai-review");
    expect(result.current.aiReviewPanelOpen).toBe(true);

    rerender({
      isCompactViewport: false,
      selectedConversationId: conversationId("conv-1"),
      isSidecarEnabled: false,
    });
    expect(result.current.activeCompactPanel).toBeNull();
    expect(result.current.aiReviewPanelOpen).toBe(false);
  });

  it("closeCompactPanel resets panel and focuses reply input", () => {
    const focusReplyInput = vi.fn();
    const { result } = renderHook(() =>
      useInboxCompactPanels({
        isCompactViewport: true,
        selectedConversationId: conversationId("conv-1"),
        isSidecarEnabled: true,
        focusReplyInput,
      })
    );

    act(() => {
      result.current.toggleAuxiliaryPanel("ai-review");
    });
    expect(result.current.activeCompactPanel).toBe("ai-review");

    act(() => {
      result.current.closeCompactPanel();
    });
    expect(result.current.activeCompactPanel).toBeNull();
    expect(focusReplyInput).toHaveBeenCalledTimes(1);
  });
});
