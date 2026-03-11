import { useState } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Id } from "@opencom/convex/dataModel";
import {
  buildInboxRouteWithConversationId,
  getQueryConversationId,
  useInboxSelectionSync,
} from "./useInboxSelectionSync";

function conversationId(value: string): Id<"conversations"> {
  return value as Id<"conversations">;
}

function createSearchParams(params: Record<string, string>) {
  return {
    get: (name: string) => params[name] ?? null,
    toString: () => new URLSearchParams(params).toString(),
  };
}

describe("useInboxSelectionSync", () => {
  it("parses both conversationId and legacy conversation query keys", () => {
    expect(getQueryConversationId(createSearchParams({ conversationId: "conv-1" }))).toBe("conv-1");
    expect(getQueryConversationId(createSearchParams({ conversation: "conv-2" }))).toBe("conv-2");
    expect(getQueryConversationId(createSearchParams({}))).toBeNull();
  });

  it("builds inbox routes with selected id and strips legacy query keys", () => {
    expect(
      buildInboxRouteWithConversationId({
        searchParams: createSearchParams({ filter: "open", conversation: "legacy-id" }),
        selectedConversationId: conversationId("conv-9"),
      })
    ).toBe("/inbox?filter=open&conversationId=conv-9");

    expect(
      buildInboxRouteWithConversationId({
        searchParams: createSearchParams({ filter: "open", conversation: "legacy-id" }),
        selectedConversationId: null,
      })
    ).toBe("/inbox?filter=open");
  });

  it("adopts a valid query conversation id into selected state", async () => {
    const setSelectionSpy = vi.fn<(id: Id<"conversations"> | null) => void>();
    const clearWorkflowError = vi.fn();
    const resetCompactPanel = vi.fn();
    const routerReplace = vi.fn();
    const conversations = [{ _id: conversationId("conv-1") }];
    const searchParams = createSearchParams({ conversationId: "conv-1" });

    const { result } = renderHook(() => {
      const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(
        null
      );

      useInboxSelectionSync({
        conversations,
        isConversationsLoading: false,
        selectedConversationId,
        setSelectedConversationId: (id) => {
          setSelectionSpy(id);
          setSelectedConversationId(id);
        },
        resetCompactPanel,
        clearWorkflowError,
        searchParams,
        router: {
          replace: routerReplace,
        },
      });

      return { selectedConversationId };
    });

    await waitFor(() => {
      expect(result.current.selectedConversationId).toBe(conversationId("conv-1"));
    });
    expect(setSelectionSpy).toHaveBeenCalledWith(conversationId("conv-1"));
    expect(clearWorkflowError).toHaveBeenCalledTimes(1);
    expect(routerReplace).not.toHaveBeenCalled();
    expect(resetCompactPanel).not.toHaveBeenCalled();
  });

  it("clears invalid selected conversation and resets compact state", async () => {
    const resetCompactPanel = vi.fn();

    const { result } = renderHook(() => {
      const [selectedConversationId, setSelectedConversationId] = useState<Id<"conversations"> | null>(
        conversationId("conv-missing")
      );

      useInboxSelectionSync({
        conversations: [{ _id: conversationId("conv-1") }],
        isConversationsLoading: false,
        selectedConversationId,
        setSelectedConversationId,
        resetCompactPanel,
        clearWorkflowError: vi.fn(),
        searchParams: createSearchParams({}),
        router: {
          replace: vi.fn(),
        },
      });

      return { selectedConversationId };
    });

    await waitFor(() => {
      expect(result.current.selectedConversationId).toBeNull();
    });
    expect(resetCompactPanel).toHaveBeenCalledTimes(1);
  });

  it("updates url when selection differs from query and removes legacy key", async () => {
    const routerReplace = vi.fn();

    renderHook(() =>
      useInboxSelectionSync({
        conversations: [{ _id: conversationId("conv-1") }, { _id: conversationId("conv-2") }],
        isConversationsLoading: false,
        selectedConversationId: conversationId("conv-2"),
        setSelectedConversationId: vi.fn(),
        resetCompactPanel: vi.fn(),
        clearWorkflowError: vi.fn(),
        searchParams: createSearchParams({
          filter: "open",
          conversation: "legacy-id",
        }),
        router: {
          replace: routerReplace,
        },
      })
    );

    await waitFor(() => {
      expect(routerReplace).toHaveBeenCalledWith("/inbox?filter=open&conversationId=conv-2", {
        scroll: false,
      });
    });
  });
});
