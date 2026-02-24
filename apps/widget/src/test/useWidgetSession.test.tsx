import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation } from "convex/react";
import { useWidgetSession } from "../hooks/useWidgetSession";
import type { Id } from "@opencom/convex/dataModel";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("@opencom/convex", () => ({
  api: {
    widgetSessions: {
      boot: "widgetSessions.boot",
      refresh: "widgetSessions.refresh",
    },
    visitors: {
      heartbeat: "visitors.heartbeat",
    },
    workspaces: {
      recordHostedOnboardingVerificationEvent: "workspaces.recordHostedOnboardingVerificationEvent",
    },
  },
}));

const workspaceId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

function Harness({ isOpen }: { isOpen: boolean }) {
  useWidgetSession({
    activeWorkspaceId: workspaceId,
    userInfo: undefined,
    workspaceValidation: { _id: workspaceId },
    isOpen,
  });

  return null;
}

describe("useWidgetSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("boots a visitor session even when widget is closed", async () => {
    const bootMock = vi.fn().mockResolvedValue({
      visitor: { _id: "visitor_1" as Id<"visitors"> },
      sessionToken: "wst_test_token",
      expiresAt: Date.now() + 60_000,
    });
    const refreshMock = vi.fn();
    const heartbeatMock = vi.fn();

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;

    mockedUseMutation.mockImplementation((mutationRef: unknown) => {
      if (mutationRef === "widgetSessions.boot") {
        return bootMock;
      }
      if (mutationRef === "widgetSessions.refresh") {
        return refreshMock;
      }
      if (mutationRef === "visitors.heartbeat") {
        return heartbeatMock;
      }
      return vi.fn();
    });

    render(<Harness isOpen={false} />);

    await waitFor(() => {
      expect(bootMock).toHaveBeenCalledTimes(1);
    });

    expect(heartbeatMock).not.toHaveBeenCalled();
  });
});
