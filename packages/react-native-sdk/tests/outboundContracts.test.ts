import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const useQueryMock = vi.fn();
  const useMutationMock = vi.fn();
  const useOpencomContextMock = vi.fn();
  const getVisitorStateMock = vi.fn();
  const trackImpressionMutation = vi.fn();
  return {
    useQueryMock,
    useMutationMock,
    useOpencomContextMock,
    getVisitorStateMock,
    trackImpressionMutation,
  };
});

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mocks.useQueryMock(...args),
  useMutation: (...args: unknown[]) => mocks.useMutationMock(...args),
}));

vi.mock("../src/components/OpencomProvider", () => ({
  useOpencomContext: () => mocks.useOpencomContextMock(),
  useOptionalOpencomContext: () => mocks.useOpencomContextMock(),
}));

vi.mock("@opencom/sdk-core", () => ({
  getVisitorState: () => mocks.getVisitorStateMock(),
}));

import { useOutboundMessages } from "../src/hooks/useOutboundMessages";

describe("react-native-sdk outbound contracts", () => {
  const resolveFunctionPath = (ref: unknown): string => {
    if (typeof ref === "string") {
      return ref;
    }

    if (!ref || typeof ref !== "object") {
      return "";
    }

    const maybeRef = ref as {
      functionName?: string;
      reference?: { functionName?: string };
      name?: string;
      referencePath?: string;
      function?: { name?: string };
      [key: string]: unknown;
    };

    const symbolFunctionName = Object.getOwnPropertySymbols(ref).find((symbol) =>
      String(symbol).includes("functionName")
    );
    const symbolValue = symbolFunctionName
      ? (ref as Record<symbol, unknown>)[symbolFunctionName]
      : undefined;

    return (
      (typeof symbolValue === "string" ? symbolValue : undefined) ??
      maybeRef.functionName ??
      maybeRef.reference?.functionName ??
      maybeRef.name ??
      maybeRef.referencePath ??
      maybeRef.function?.name ??
      ""
    );
  };

  const expectFunctionPath = (ref: unknown, expectedPath: string) => {
    const actualPath = resolveFunctionPath(ref);
    expect([expectedPath, expectedPath.replace(":", ".")]).toContain(actualPath);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useOpencomContextMock.mockReturnValue({ workspaceId: "workspace_contract" });
    mocks.getVisitorStateMock.mockReturnValue({
      visitorId: "visitor_contract",
      sessionId: "session_contract",
      sessionToken: "wst_contract_token",
    });
    mocks.useQueryMock.mockReturnValue([]);
    mocks.trackImpressionMutation.mockResolvedValue(undefined);
    mocks.useMutationMock.mockReturnValue(mocks.trackImpressionMutation);
  });

  it("queries eligible outbound messages with stable visitor/session args", () => {
    const result = useOutboundMessages("https://app.opencom.dev/path");

    expectFunctionPath(mocks.useQueryMock.mock.calls[0][0], "outboundMessages:getEligible");
    expect(mocks.useQueryMock.mock.calls[0][1]).toEqual({
      workspaceId: "workspace_contract",
      visitorId: "visitor_contract",
      sessionToken: "wst_contract_token",
      currentUrl: "https://app.opencom.dev/path",
      sessionId: "session_contract",
    });
    expect(result.messages).toEqual([]);
    expect(result.isLoading).toBe(false);
  });

  it("sends stable impression actions for seen/click/dismiss", async () => {
    const result = useOutboundMessages("https://app.opencom.dev/path");

    await result.markAsSeen("outbound_1" as never);
    await result.trackClick("outbound_1" as never, 1);
    await result.trackDismiss("outbound_1" as never);

    expect(mocks.trackImpressionMutation).toHaveBeenNthCalledWith(1, {
      messageId: "outbound_1",
      visitorId: "visitor_contract",
      sessionToken: "wst_contract_token",
      sessionId: "session_contract",
      action: "shown",
    });
    expect(mocks.trackImpressionMutation).toHaveBeenNthCalledWith(2, {
      messageId: "outbound_1",
      visitorId: "visitor_contract",
      sessionToken: "wst_contract_token",
      sessionId: "session_contract",
      action: "clicked",
      buttonIndex: 1,
    });
    expect(mocks.trackImpressionMutation).toHaveBeenNthCalledWith(3, {
      messageId: "outbound_1",
      visitorId: "visitor_contract",
      sessionToken: "wst_contract_token",
      sessionId: "session_contract",
      action: "dismissed",
    });
  });

  it("skips network operations when visitor session is incomplete", async () => {
    mocks.getVisitorStateMock.mockReturnValueOnce({
      visitorId: "visitor_contract",
      sessionId: "session_contract",
      sessionToken: null,
    });

    const result = useOutboundMessages("https://app.opencom.dev/path");

    expectFunctionPath(mocks.useQueryMock.mock.calls[0][0], "outboundMessages:getEligible");
    expect(mocks.useQueryMock.mock.calls[0][1]).toBe("skip");

    await result.markAsSeen("outbound_2" as never);
    await result.trackClick("outbound_2" as never, 0);
    await result.trackDismiss("outbound_2" as never);

    expect(mocks.trackImpressionMutation).not.toHaveBeenCalled();
  });
});
