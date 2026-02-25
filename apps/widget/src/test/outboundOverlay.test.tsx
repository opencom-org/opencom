import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation, useQuery } from "convex/react";
import type { Id } from "@opencom/convex/dataModel";
import { OutboundOverlay } from "../OutboundOverlay";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
}));

vi.mock("@opencom/convex", () => ({
  api: {
    outboundMessages: {
      getEligible: "outboundMessages.getEligible",
      trackImpression: "outboundMessages.trackImpression",
    },
  },
}));

describe("OutboundOverlay", () => {
  const workspaceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Id<"workspaces">;
  const visitorId = "visitor_1" as Id<"visitors">;

  function setupEligibleMessages(messages: unknown[]) {
    const trackImpressionMock = vi.fn().mockResolvedValue(undefined);
    const mockedUseQuery = useQuery as unknown as ReturnType<typeof vi.fn>;
    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;

    mockedUseQuery.mockReturnValue(messages);
    mockedUseMutation.mockImplementation((mutationRef: unknown) => {
      if (mutationRef === "outboundMessages.trackImpression") {
        return trackImpressionMock;
      }
      return vi.fn();
    });

    return { trackImpressionMock };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders immediate outbound chat once visitor session is booted", async () => {
    const { trackImpressionMock } = setupEligibleMessages([
      {
        _id: "msg_1" as Id<"outboundMessages">,
        type: "chat",
        name: "pre-open-chat",
        content: {
          text: "Pre-open outbound message",
        },
        triggers: {
          type: "immediate",
        },
      },
    ]);

    render(
      <OutboundOverlay
        workspaceId={workspaceId}
        visitorId={visitorId}
        sessionToken="wst_test"
        sessionId="session_1"
        currentUrl="http://localhost:4000/"
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Pre-open outbound message")).toBeVisible();
    });

    expect(trackImpressionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "shown",
        sessionId: "session_1",
      })
    );
  });

  it("executes configured post CTA action and uses configured labels", async () => {
    const onStartConversation = vi.fn();
    const onOpenMessenger = vi.fn();

    setupEligibleMessages([
      {
        _id: "post_1" as Id<"outboundMessages">,
        type: "post",
        name: "post-cta",
        content: {
          title: "Important update",
          body: "Please review this update",
          clickAction: {
            type: "open_messenger",
          },
          buttons: [
            {
              text: "Book demo",
              action: "open_new_conversation",
              prefillMessage: "I want a demo",
            },
            {
              text: "Not now",
              action: "dismiss",
            },
          ],
        },
        triggers: {
          type: "immediate",
        },
      },
    ]);

    render(
      <OutboundOverlay
        workspaceId={workspaceId}
        visitorId={visitorId}
        sessionToken="wst_test"
        sessionId="session_1"
        currentUrl="http://localhost:4000/"
        onStartConversation={onStartConversation}
        onOpenMessenger={onOpenMessenger}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Book demo")).toBeVisible();
      expect(screen.getByText("Not now")).toBeVisible();
    });

    fireEvent.click(screen.getByText("Book demo"));

    expect(onStartConversation).toHaveBeenCalledWith("I want a demo");
    expect(onOpenMessenger).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.queryByText("Book demo")).not.toBeInTheDocument();
    });
  });

  it("post dismiss button only dismisses and does not run content click action", async () => {
    const onOpenMessenger = vi.fn();

    setupEligibleMessages([
      {
        _id: "post_2" as Id<"outboundMessages">,
        type: "post",
        name: "post-dismiss",
        content: {
          title: "Release notes",
          body: "Read what changed",
          clickAction: {
            type: "open_messenger",
          },
          buttons: [
            {
              text: "Dismiss update",
              action: "dismiss",
            },
          ],
        },
        triggers: {
          type: "immediate",
        },
      },
    ]);

    render(
      <OutboundOverlay
        workspaceId={workspaceId}
        visitorId={visitorId}
        sessionToken="wst_test"
        sessionId="session_1"
        currentUrl="http://localhost:4000/"
        onOpenMessenger={onOpenMessenger}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Dismiss update")).toBeVisible();
    });

    fireEvent.click(screen.getByText("Dismiss update"));

    expect(onOpenMessenger).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(screen.queryByText("Dismiss update")).not.toBeInTheDocument();
    });
  });

  it("defers blocking post until the scheduler allows it", async () => {
    const onBlockingStateChange = vi.fn();

    setupEligibleMessages([
      {
        _id: "post_queued" as Id<"outboundMessages">,
        type: "post",
        name: "queued-post",
        content: {
          title: "Queued post",
          body: "Waits for active blocker to finish",
          buttons: [{ text: "Dismiss", action: "dismiss" }],
        },
        triggers: {
          type: "immediate",
        },
      },
    ]);

    const { rerender } = render(
      <OutboundOverlay
        workspaceId={workspaceId}
        visitorId={visitorId}
        sessionToken="wst_test"
        sessionId="session_1"
        currentUrl="http://localhost:4000/"
        allowBlockingPost={false}
        onBlockingStateChange={onBlockingStateChange}
      />
    );

    await waitFor(() => {
      expect(onBlockingStateChange).toHaveBeenCalledWith({
        hasPendingPost: true,
        hasActivePost: false,
      });
    });
    expect(screen.queryByText("Queued post")).not.toBeInTheDocument();

    rerender(
      <OutboundOverlay
        workspaceId={workspaceId}
        visitorId={visitorId}
        sessionToken="wst_test"
        sessionId="session_1"
        currentUrl="http://localhost:4000/"
        allowBlockingPost
        onBlockingStateChange={onBlockingStateChange}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Queued post")).toBeVisible();
    });
  });
});
