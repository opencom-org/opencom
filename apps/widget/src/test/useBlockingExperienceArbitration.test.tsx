import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBlockingExperienceArbitration } from "../hooks/useBlockingExperienceArbitration";

describe("useBlockingExperienceArbitration", () => {
  it("prioritizes tour over outbound post and large survey candidates", async () => {
    const { result } = renderHook(() =>
      useBlockingExperienceArbitration({
        hasTourBlockingCandidate: true,
        hasOutboundPostBlockingCandidate: true,
        hasOutboundPostBlockingActive: false,
        hasLargeSurveyBlockingCandidate: true,
        hasLargeSurveyBlockingActive: false,
        tourBlockingActive: false,
      })
    );

    await waitFor(() => {
      expect(result.current.allowTourBlocking).toBe(true);
    });
    expect(result.current.allowOutboundPostBlocking).toBe(false);
    expect(result.current.allowLargeSurveyBlocking).toBe(false);
  });
});
