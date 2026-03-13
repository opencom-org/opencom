import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import { useInboxSuggestionsCount } from "./useInboxSuggestionsCount";

function conversationId(value: string): Id<"conversations"> {
  return value as Id<"conversations">;
}

describe("useInboxSuggestionsCount", () => {
  it("resets count to 0 when selectedConversationId is null", async () => {
    const getSuggestionsForConversation = vi.fn().mockResolvedValue([{}, {}, {}]);

    const { result } = renderHook(() =>
      useInboxSuggestionsCount({
        selectedConversationId: null,
        isSidecarEnabled: true,
        messageCountSignal: 0,
        getSuggestionsForConversation,
      })
    );

    expect(result.current.suggestionsCount).toBe(0);
    expect(result.current.isSuggestionsCountLoading).toBe(false);
    expect(getSuggestionsForConversation).not.toHaveBeenCalled();
  });

  it("resets count to 0 when sidecar is disabled", async () => {
    const getSuggestionsForConversation = vi.fn().mockResolvedValue([{}, {}, {}]);

    const { result } = renderHook(() =>
      useInboxSuggestionsCount({
        selectedConversationId: conversationId("conv-1"),
        isSidecarEnabled: false,
        messageCountSignal: 0,
        getSuggestionsForConversation,
      })
    );

    expect(result.current.suggestionsCount).toBe(0);
    expect(result.current.isSuggestionsCountLoading).toBe(false);
    expect(getSuggestionsForConversation).not.toHaveBeenCalled();
  });

  it("sets and clears isSuggestionsCountLoading during fetch", async () => {
    let resolvePromise: (value: unknown[]) => void;
    const getSuggestionsForConversation = vi.fn().mockImplementation(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolvePromise = resolve;
        })
    );

    const { result } = renderHook(() =>
      useInboxSuggestionsCount({
        selectedConversationId: conversationId("conv-1"),
        isSidecarEnabled: true,
        messageCountSignal: 0,
        getSuggestionsForConversation,
      })
    );

    await waitFor(() => {
      expect(result.current.isSuggestionsCountLoading).toBe(true);
    });

    resolvePromise!([{}, {}, {}]);

    await waitFor(() => {
      expect(result.current.suggestionsCount).toBe(3);
      expect(result.current.isSuggestionsCountLoading).toBe(false);
    });
  });

  it("ignores async results after unmount", async () => {
    let resolvePromise: (value: unknown[]) => void;
    const getSuggestionsForConversation = vi.fn().mockImplementation(
      () =>
        new Promise<unknown[]>((resolve) => {
          resolvePromise = resolve;
        })
    );

    const { result, unmount } = renderHook(() =>
      useInboxSuggestionsCount({
        selectedConversationId: conversationId("conv-1"),
        isSidecarEnabled: true,
        messageCountSignal: 0,
        getSuggestionsForConversation,
      })
    );

    await waitFor(() => {
      expect(result.current.isSuggestionsCountLoading).toBe(true);
    });

    unmount();
    resolvePromise!([{}, {}, {}]);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(result.current.suggestionsCount).toBe(0);
  });

  it("ignores stale results when conversation changes", async () => {
    let resolveFirst: (value: unknown[]) => void;
    let resolveSecond: (value: unknown[]) => void;

    const getSuggestionsForConversation = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<unknown[]>((resolve) => {
            resolveFirst = resolve;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise<unknown[]>((resolve) => {
            resolveSecond = resolve;
          })
      );

    const { result, rerender } = renderHook(
      ({ selectedConversationId }: { selectedConversationId: Id<"conversations"> }) =>
        useInboxSuggestionsCount({
          selectedConversationId,
          isSidecarEnabled: true,
          messageCountSignal: 0,
          getSuggestionsForConversation,
        }),
      { initialProps: { selectedConversationId: conversationId("conv-1") } }
    );

    await waitFor(() => {
      expect(result.current.isSuggestionsCountLoading).toBe(true);
    });

    rerender({ selectedConversationId: conversationId("conv-2") });

    resolveFirst!([{}, {}, {}]);
    resolveSecond!([{}]);

    await waitFor(() => {
      expect(result.current.suggestionsCount).toBe(1);
    });
  });

  it("sets count to 0 on error", async () => {
    const getSuggestionsForConversation = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() =>
      useInboxSuggestionsCount({
        selectedConversationId: conversationId("conv-1"),
        isSidecarEnabled: true,
        messageCountSignal: 0,
        getSuggestionsForConversation,
      })
    );

    await waitFor(() => {
      expect(result.current.suggestionsCount).toBe(0);
      expect(result.current.isSuggestionsCountLoading).toBe(false);
    });
  });
});
