import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMutation } from "convex/react";
import type { Id } from "@opencom/convex/dataModel";
import { TourOverlay } from "../TourOverlay";

vi.mock("convex/react", () => ({
  useMutation: vi.fn(),
}));

vi.mock("@opencom/convex", () => ({
  api: {
    tourProgress: {
      start: "tourProgress.start",
      advance: "tourProgress.advance",
      dismiss: "tourProgress.dismiss",
      dismissPermanently: "tourProgress.dismissPermanently",
      snooze: "tourProgress.snooze",
      restart: "tourProgress.restart",
      skipStep: "tourProgress.skipStep",
      checkpoint: "tourProgress.checkpoint",
    },
  },
}));

function buildMockTour() {
  const tourId = "tour_1" as Id<"tours">;
  return {
    tour: {
      _id: tourId,
      name: "Broken Tour",
      displayMode: "first_time_only" as const,
      buttonColor: "#792cd4",
    },
    steps: [
      {
        _id: "step_1" as Id<"tourSteps">,
        tourId,
        type: "pointer" as const,
        order: 0,
        title: "Broken Step",
        content: "Broken selector should trigger graceful recovery",
        // Intentionally invalid CSS selector to simulate misconfiguration.
        elementSelector: "[data-testid='broken-selector'",
        advanceOn: "elementClick" as const,
      },
    ],
  };
}

describe("TourOverlay", () => {
  const originalMutationObserver = globalThis.MutationObserver;

  beforeEach(() => {
    vi.clearAllMocks();
    class NoopMutationObserver {
      disconnect() {
        // noop
      }
      observe() {
        // noop
      }
      takeRecords() {
        return [];
      }
    }

    globalThis.MutationObserver = NoopMutationObserver as unknown as typeof MutationObserver;
  });

  afterEach(() => {
    globalThis.MutationObserver = originalMutationObserver;
  });

  it("shows recovery UI and allows guaranteed exit when selector is invalid", async () => {
    const startMock = vi.fn().mockResolvedValue(undefined);
    const dismissMock = vi.fn().mockResolvedValue(undefined);
    const skipStepMock = vi.fn().mockRejectedValue(new Error("skip failed"));
    const defaultMutationMock = vi.fn().mockResolvedValue(undefined);

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockImplementation((mutationRef: unknown) => {
      if (mutationRef === "tourProgress.start") return startMock;
      if (mutationRef === "tourProgress.dismiss") return dismissMock;
      if (mutationRef === "tourProgress.skipStep") return skipStepMock;
      return defaultMutationMock;
    });

    render(
      <TourOverlay
        workspaceId={"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Id<"workspaces">}
        visitorId={"visitor_1" as Id<"visitors">}
        sessionToken="wst_test"
        availableTours={[buildMockTour()]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("tour-overlay")).toBeVisible();
    });

    await waitFor(() => {
      expect(screen.getByTestId("tour-recovery-hint")).toBeVisible();
    });

    const emergencyClose = screen.getByTestId("tour-emergency-close");
    expect(emergencyClose).toBeVisible();

    fireEvent.click(emergencyClose);

    await waitFor(() => {
      expect(screen.queryByTestId("tour-overlay")).not.toBeInTheDocument();
    });

    expect(dismissMock).toHaveBeenCalledTimes(1);
  });

  it("defers tooltip reposition during smooth scroll until settle and keeps controls usable", async () => {
    const startMock = vi.fn().mockResolvedValue(undefined);
    const dismissMock = vi.fn().mockResolvedValue(undefined);
    const checkpointMock = vi.fn().mockResolvedValue(undefined);
    const advanceMock = vi.fn().mockResolvedValue({
      advanced: true,
      nextStep: 0,
      status: "in_progress",
    });
    const defaultMutationMock = vi.fn().mockResolvedValue(undefined);

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockImplementation((mutationRef: unknown) => {
      if (mutationRef === "tourProgress.start") return startMock;
      if (mutationRef === "tourProgress.dismiss") return dismissMock;
      if (mutationRef === "tourProgress.checkpoint") return checkpointMock;
      if (mutationRef === "tourProgress.advance") return advanceMock;
      return defaultMutationMock;
    });

    const targetElement = document.createElement("button");
    targetElement.setAttribute("data-testid", "tour-scroll-target");
    document.body.appendChild(targetElement);

    let top = -320;
    let left = 48;
    const width = 120;
    const height = 40;
    vi.spyOn(targetElement, "getBoundingClientRect").mockImplementation(() => ({
      x: left,
      y: top,
      top,
      left,
      width,
      height,
      right: left + width,
      bottom: top + height,
      toJSON: () => ({}),
    }));

    const scrollIntoViewMock = vi.fn();
    Object.defineProperty(targetElement, "scrollIntoView", {
      value: scrollIntoViewMock,
      configurable: true,
    });

    const tourId = "tour_scroll" as Id<"tours">;

    render(
      <TourOverlay
        workspaceId={"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Id<"workspaces">}
        visitorId={"visitor_1" as Id<"visitors">}
        sessionToken="wst_test"
        availableTours={[
          {
            tour: {
              _id: tourId,
              name: "Scroll Stable Tour",
              displayMode: "first_time_only",
              buttonColor: "#792cd4",
            },
            steps: [
              {
                _id: "step_scroll" as Id<"tourSteps">,
                tourId,
                type: "pointer",
                order: 0,
                title: "Scroll step",
                content: "Tooltip should stay stable while scrolling.",
                elementSelector: "[data-testid='tour-scroll-target']",
                advanceOn: "click",
              },
            ],
          },
        ]}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("tour-step-card")).toBeVisible();
    });

    const tooltip = screen.getByTestId("tour-step-card");
    const initialPosition = `${tooltip.style.top}|${tooltip.style.left}`;
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

    try {
      top = 140;
      left = 96;
      window.dispatchEvent(new Event("scroll"));

      const midScrollPosition = `${tooltip.style.top}|${tooltip.style.left}`;
      expect(midScrollPosition).toBe(initialPosition);

      await waitFor(
        () => {
          expect(`${tooltip.style.top}|${tooltip.style.left}`).not.toBe(initialPosition);
        },
        { timeout: 1000 }
      );

      const primaryAction = screen.getByTestId("tour-primary-action");
      expect(primaryAction).toBeVisible();
      expect(screen.getByTestId("tour-emergency-close")).toBeVisible();

      fireEvent.click(screen.getByTestId("tour-emergency-close"));
      await waitFor(() => {
        expect(screen.queryByTestId("tour-overlay")).not.toBeInTheDocument();
      });
      expect(dismissMock).toHaveBeenCalledTimes(1);
    } finally {
      targetElement.remove();
    }
  });

  it("waits to render the next step card until transition scroll settles", async () => {
    const startMock = vi.fn().mockResolvedValue(undefined);
    const dismissMock = vi.fn().mockResolvedValue(undefined);
    const checkpointMock = vi.fn().mockResolvedValue(undefined);
    const advanceMock = vi.fn().mockResolvedValue({
      advanced: true,
      nextStep: 1,
      status: "in_progress",
    });
    const defaultMutationMock = vi.fn().mockResolvedValue(undefined);

    const mockedUseMutation = useMutation as unknown as ReturnType<typeof vi.fn>;
    mockedUseMutation.mockImplementation((mutationRef: unknown) => {
      if (mutationRef === "tourProgress.start") return startMock;
      if (mutationRef === "tourProgress.dismiss") return dismissMock;
      if (mutationRef === "tourProgress.checkpoint") return checkpointMock;
      if (mutationRef === "tourProgress.advance") return advanceMock;
      return defaultMutationMock;
    });

    const stepOneTarget = document.createElement("button");
    stepOneTarget.setAttribute("data-testid", "tour-step-one-target");
    document.body.appendChild(stepOneTarget);

    const stepTwoTarget = document.createElement("button");
    stepTwoTarget.setAttribute("data-testid", "tour-step-two-target");
    document.body.appendChild(stepTwoTarget);

    let stepTwoTop = -280;
    let stepTwoLeft = 72;

    vi.spyOn(stepOneTarget, "getBoundingClientRect").mockImplementation(() => ({
      x: 100,
      y: 180,
      top: 180,
      left: 100,
      width: 140,
      height: 44,
      right: 240,
      bottom: 224,
      toJSON: () => ({}),
    }));

    vi.spyOn(stepTwoTarget, "getBoundingClientRect").mockImplementation(() => ({
      x: stepTwoLeft,
      y: stepTwoTop,
      top: stepTwoTop,
      left: stepTwoLeft,
      width: 160,
      height: 48,
      right: stepTwoLeft + 160,
      bottom: stepTwoTop + 48,
      toJSON: () => ({}),
    }));

    const stepTwoScrollIntoViewMock = vi.fn();
    Object.defineProperty(stepTwoTarget, "scrollIntoView", {
      value: stepTwoScrollIntoViewMock,
      configurable: true,
    });

    const tourId = "tour_transition_scroll" as Id<"tours">;

    render(
      <TourOverlay
        workspaceId={"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Id<"workspaces">}
        visitorId={"visitor_1" as Id<"visitors">}
        sessionToken="wst_test"
        availableTours={[
          {
            tour: {
              _id: tourId,
              name: "Transition Scroll Tour",
              displayMode: "first_time_only",
              buttonColor: "#792cd4",
            },
            steps: [
              {
                _id: "transition_step_one" as Id<"tourSteps">,
                tourId,
                type: "pointer",
                order: 0,
                title: "First step",
                content: "Click next to continue.",
                elementSelector: "[data-testid='tour-step-one-target']",
                advanceOn: "click",
              },
              {
                _id: "transition_step_two" as Id<"tourSteps">,
                tourId,
                type: "pointer",
                order: 1,
                title: "Second step",
                content: "This card should wait until scroll settles.",
                elementSelector: "[data-testid='tour-step-two-target']",
                advanceOn: "click",
              },
            ],
          },
        ]}
      />
    );

    try {
      await waitFor(() => {
        expect(screen.getByText("First step")).toBeVisible();
      });

      fireEvent.click(screen.getByTestId("tour-primary-action"));

      await waitFor(() => {
        expect(advanceMock).toHaveBeenCalledTimes(1);
      });
      expect(stepTwoScrollIntoViewMock).toHaveBeenCalledTimes(1);

      expect(screen.queryByText("Second step")).not.toBeInTheDocument();
      expect(screen.queryByTestId("tour-step-card")).not.toBeInTheDocument();

      stepTwoTop = 220;
      stepTwoLeft = 160;
      window.dispatchEvent(new Event("scroll"));

      await waitFor(() => {
        expect(screen.getByText("Second step")).toBeVisible();
      });
      expect(screen.getByTestId("tour-step-card")).toBeVisible();
    } finally {
      stepOneTarget.remove();
      stepTwoTarget.remove();
    }
  });
});
