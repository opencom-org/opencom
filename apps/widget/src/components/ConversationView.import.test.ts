import { describe, expect, it, vi } from "vitest";

vi.mock("convex/react", () => ({
  useQuery: vi.fn(),
  useMutation: vi.fn(),
  useAction: vi.fn(),
}));

vi.mock("convex/server", () => ({
  makeFunctionReference: (functionName: string) => ({ functionName }),
}));

vi.mock("../icons", () => ({
  ChevronLeft: () => null,
  X: () => null,
  User: () => null,
}));

vi.mock("../hooks/useDebouncedValue", () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));

vi.mock("../utils/parseMarkdown", () => ({
  parseMarkdown: (input: string) => input,
}));

vi.mock("./conversationView/constants", () => ({
  MANUAL_HANDOFF_REASON: "Visitor clicked Talk to human button",
}));

vi.mock("./conversationView/MessageList", () => ({
  ConversationMessageList: () => null,
}));

vi.mock("./conversationView/Footer", () => ({
  ConversationFooter: () => null,
}));

describe("ConversationView import smoke", () => {
  it("imports the module", async () => {
    const mod = await import("./ConversationView");
    expect(mod.ConversationView).toBeTypeOf("function");
  });
});
