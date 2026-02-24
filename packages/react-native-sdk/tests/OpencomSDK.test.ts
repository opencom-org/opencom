import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the sdk-core client
vi.mock("@opencom/sdk-core", () => ({
  initializeClient: vi.fn(),
  getClient: vi.fn(() => ({
    mutation: vi.fn(),
    query: vi.fn(),
  })),
  getConfig: vi.fn(() => ({
    workspaceId: "test-workspace",
    convexUrl: "https://test.convex.cloud",
  })),
  isInitialized: vi.fn(() => true),
  resetClient: vi.fn(),
  bootSession: vi.fn(),
  refreshSession: vi.fn(),
  revokeSession: vi.fn(async () => undefined),
  identifyVisitor: vi.fn(),
  trackEvent: vi.fn(),
  trackAutoEvent: vi.fn(async () => undefined),
  heartbeat: vi.fn(async () => undefined),
  setStorageAdapter: vi.fn(),
  setVisitorId: vi.fn(),
  setSessionId: vi.fn(),
  setSessionToken: vi.fn(),
  setSessionExpiresAt: vi.fn(),
  clearSessionToken: vi.fn(),
  setUser: vi.fn(),
  clearUser: vi.fn(),
  resetVisitorState: vi.fn(),
  getVisitorState: vi.fn(() => ({
    visitorId: "visitor_123",
    sessionId: "session_456",
    sessionToken: "wst_test123",
    sessionExpiresAt: Date.now() + 3600000,
  })),
  generateSessionId: vi.fn(() => "session_new_789"),
  emitEvent: vi.fn(),
  addEventListener: vi.fn(() => () => {}),
  getOrCreateConversation: vi.fn(),
  createConversation: vi.fn(),
  getMessages: vi.fn(() => []),
  getConversations: vi.fn(() => []),
  sendMessage: vi.fn(),
}));

// Mock AsyncStorage
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

describe("OpencomSDK", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { OpencomSDK } = await import("../src/OpencomSDK");
    await OpencomSDK.reset();
  });

  describe("initialize", () => {
    it("should initialize with valid config", async () => {
      const { initializeClient } = await import("@opencom/sdk-core");
      const { OpencomSDK } = await import("../src/OpencomSDK");
      const { bootSession } = await import("@opencom/sdk-core");

      vi.mocked(bootSession).mockResolvedValue({
        visitor: { _id: "visitor_123" as any },
        sessionToken: "wst_test123",
        expiresAt: Date.now() + 3600000,
      } as any);

      await OpencomSDK.initialize({
        workspaceId: "test-workspace",
        convexUrl: "https://test.convex.cloud",
      });

      expect(initializeClient).toHaveBeenCalledWith({
        workspaceId: "test-workspace",
        convexUrl: "https://test.convex.cloud",
      });
    });

    it("should throw error without workspaceId", async () => {
      const { OpencomSDK } = await import("../src/OpencomSDK");

      await expect(
        OpencomSDK.initialize({
          workspaceId: "",
          convexUrl: "https://test.convex.cloud",
        })
      ).rejects.toThrow();
    });

    it("should throw error without convexUrl", async () => {
      const { OpencomSDK } = await import("../src/OpencomSDK");

      await expect(
        OpencomSDK.initialize({
          workspaceId: "test-workspace",
          convexUrl: "",
        })
      ).rejects.toThrow();
    });
  });

  describe("identify", () => {
    it("should identify user with email", async () => {
      const { identifyVisitor } = await import("@opencom/sdk-core");
      const { bootSession } = await import("@opencom/sdk-core");
      const { OpencomSDK } = await import("../src/OpencomSDK");

      // Initialize first
      vi.mocked(bootSession).mockResolvedValue({
        visitor: { _id: "visitor_123" as any },
        sessionToken: "wst_test123",
        expiresAt: Date.now() + 3600000,
      } as any);

      await OpencomSDK.initialize({
        workspaceId: "test-workspace",
        convexUrl: "https://test.convex.cloud",
      });

      await OpencomSDK.identify({
        email: "test@example.com",
        name: "Test User",
      });

      expect(identifyVisitor).toHaveBeenCalled();
    });

    it("should identify user with userId", async () => {
      const { identifyVisitor } = await import("@opencom/sdk-core");
      const { bootSession } = await import("@opencom/sdk-core");
      const { OpencomSDK } = await import("../src/OpencomSDK");

      vi.mocked(bootSession).mockResolvedValue({
        visitor: { _id: "visitor_123" as any },
        sessionToken: "wst_test123",
        expiresAt: Date.now() + 3600000,
      } as any);

      await OpencomSDK.initialize({
        workspaceId: "test-workspace",
        convexUrl: "https://test.convex.cloud",
      });

      await OpencomSDK.identify({
        userId: "user-123",
        customAttributes: { plan: "pro" },
      });

      expect(identifyVisitor).toHaveBeenCalled();
    });
  });

  describe("trackEvent", () => {
    it("should track event with name only", async () => {
      const { trackEvent } = await import("@opencom/sdk-core");
      const { bootSession } = await import("@opencom/sdk-core");
      const { OpencomSDK } = await import("../src/OpencomSDK");

      vi.mocked(bootSession).mockResolvedValue({
        visitor: { _id: "visitor_123" as any },
        sessionToken: "wst_test123",
        expiresAt: Date.now() + 3600000,
      } as any);

      await OpencomSDK.initialize({
        workspaceId: "test-workspace",
        convexUrl: "https://test.convex.cloud",
      });

      await OpencomSDK.trackEvent("button_clicked");

      expect(trackEvent).toHaveBeenCalled();
    });

    it("should track event with properties", async () => {
      const { trackEvent } = await import("@opencom/sdk-core");
      const { bootSession } = await import("@opencom/sdk-core");
      const { OpencomSDK } = await import("../src/OpencomSDK");

      vi.mocked(bootSession).mockResolvedValue({
        visitor: { _id: "visitor_123" as any },
        sessionToken: "wst_test123",
        expiresAt: Date.now() + 3600000,
      } as any);

      await OpencomSDK.initialize({
        workspaceId: "test-workspace",
        convexUrl: "https://test.convex.cloud",
      });

      await OpencomSDK.trackEvent("purchase_completed", {
        amount: 99.99,
        currency: "USD",
      });

      expect(trackEvent).toHaveBeenCalled();
    });
  });

  describe("logout", () => {
    it("should revoke active session", async () => {
      const { bootSession, revokeSession } = await import("@opencom/sdk-core");
      const { OpencomSDK } = await import("../src/OpencomSDK");

      vi.mocked(bootSession).mockResolvedValue({
        visitor: { _id: "visitor_123" as any },
        sessionToken: "wst_test123",
        expiresAt: Date.now() + 3600000,
      } as any);

      await OpencomSDK.initialize({
        workspaceId: "test-workspace",
        convexUrl: "https://test.convex.cloud",
      });

      await OpencomSDK.logout();

      expect(revokeSession).toHaveBeenCalled();
    });
  });
});

describe("SDK Configuration", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { OpencomSDK } = await import("../src/OpencomSDK");
    await OpencomSDK.reset();
  });

  it("should support debug mode", async () => {
    const { initializeClient } = await import("@opencom/sdk-core");
    const { bootSession } = await import("@opencom/sdk-core");
    const { OpencomSDK } = await import("../src/OpencomSDK");

    vi.mocked(bootSession).mockResolvedValue({
      visitor: { _id: "visitor_123" as any },
      sessionToken: "wst_test123",
      expiresAt: Date.now() + 3600000,
    } as any);

    await OpencomSDK.initialize({
      workspaceId: "test-workspace",
      convexUrl: "https://test.convex.cloud",
      debug: true,
    });

    expect(initializeClient).toHaveBeenCalledWith(expect.objectContaining({ debug: true }));
  });
});

describe("Visitor ID Persistence", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset the SDK state between tests
    const { OpencomSDK } = await import("../src/OpencomSDK");
    await OpencomSDK.reset();
  });

  it("should persist visitor ID to AsyncStorage after initialization", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const { bootSession } = await import("@opencom/sdk-core");
    const { OpencomSDK } = await import("../src/OpencomSDK");
    const setItemSpy = vi.spyOn(AsyncStorage, "setItem");

    // Mock bootSession returning visitor + session token
    vi.mocked(bootSession).mockResolvedValue({
      visitor: { _id: "visitor_123" as any },
      sessionToken: "wst_test_token",
      expiresAt: Date.now() + 3600000,
    } as any);
    await OpencomSDK.initialize({
      workspaceId: "test-workspace",
      convexUrl: "https://test.convex.cloud",
    });

    // Should have called setItem with the visitor ID
    expect(setItemSpy).toHaveBeenCalledWith("opencom_visitor_id", "visitor_123");
  });

  it("should persist session token on initialization", async () => {
    const SecureStore = await import("expo-secure-store");
    const { bootSession } = await import("@opencom/sdk-core");
    const { OpencomSDK } = await import("../src/OpencomSDK");

    vi.mocked(bootSession).mockResolvedValue({
      visitor: { _id: "visitor_456" as any },
      sessionToken: "wst_persisted_token",
      expiresAt: Date.now() + 3600000,
    } as any);
    await OpencomSDK.initialize({
      workspaceId: "test-workspace",
      convexUrl: "https://test.convex.cloud",
    });

    // Should have called bootSession
    expect(bootSession).toHaveBeenCalled();
    // Should persist session credentials to secure storage
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "opencom_session_token",
      "wst_persisted_token"
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      "opencom_session_expires_at",
      expect.any(String)
    );
  });

  it("should clear visitor ID on logout", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const SecureStore = await import("expo-secure-store");
    const { bootSession } = await import("@opencom/sdk-core");
    const { OpencomSDK } = await import("../src/OpencomSDK");
    const removeItemSpy = vi.spyOn(AsyncStorage, "removeItem");

    vi.mocked(bootSession).mockResolvedValue({
      visitor: { _id: "visitor_123" as any },
      sessionToken: "wst_test_token",
      expiresAt: Date.now() + 3600000,
    } as any);
    await OpencomSDK.initialize({
      workspaceId: "test-workspace",
      convexUrl: "https://test.convex.cloud",
    });

    vi.clearAllMocks();
    vi.mocked(bootSession).mockResolvedValue({
      visitor: { _id: "visitor_new" as any },
      sessionToken: "wst_new_token",
      expiresAt: Date.now() + 3600000,
    } as any);
    await OpencomSDK.logout();

    // Should have called removeItem to clear the visitor ID
    expect(removeItemSpy).toHaveBeenCalledWith("opencom_visitor_id");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("opencom_session_token");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("opencom_session_expires_at");
  });

  it("should clear visitor ID on reset", async () => {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const SecureStore = await import("expo-secure-store");
    const { bootSession } = await import("@opencom/sdk-core");
    const { OpencomSDK } = await import("../src/OpencomSDK");
    const removeItemSpy = vi.spyOn(AsyncStorage, "removeItem");

    vi.mocked(bootSession).mockResolvedValue({
      visitor: { _id: "visitor_123" as any },
      sessionToken: "wst_test_token",
      expiresAt: Date.now() + 3600000,
    } as any);
    await OpencomSDK.initialize({
      workspaceId: "test-workspace",
      convexUrl: "https://test.convex.cloud",
    });

    vi.clearAllMocks();
    await OpencomSDK.reset();

    // Should have called removeItem to clear the visitor ID
    expect(removeItemSpy).toHaveBeenCalledWith("opencom_visitor_id");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("opencom_session_token");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("opencom_session_expires_at");
  });
});

describe("RN SDK visitor path contracts", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { bootSession } = await import("@opencom/sdk-core");
    vi.mocked(bootSession).mockResolvedValue({
      visitor: { _id: "visitor_123" as any },
      sessionToken: "wst_test123",
      expiresAt: Date.now() + 3600000,
    } as any);
  });

  it("passes visitor session args through conversation and message APIs", async () => {
    const { getOrCreateConversation, createConversation, getConversations, sendMessage } =
      await import("@opencom/sdk-core");
    const { OpencomSDK } = await import("../src/OpencomSDK");
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;

    vi.mocked(getOrCreateConversation).mockResolvedValue({ _id: "conversation_1" } as any);
    vi.mocked(createConversation).mockResolvedValue({ _id: "conversation_2" } as any);
    vi.mocked(getConversations).mockResolvedValue([]);

    await OpencomSDK.initialize({
      workspaceId: "test-workspace",
      convexUrl: "https://test.convex.cloud",
    });

    await OpencomSDK.getOrCreateConversation();
    expect(getOrCreateConversation).toHaveBeenCalledWith("visitor_123", "wst_test123");

    await OpencomSDK.createConversation();
    expect(createConversation).toHaveBeenCalledWith("visitor_123", "wst_test123");

    await OpencomSDK.getConversations();
    expect(getConversations).toHaveBeenCalledWith("visitor_123", "wst_test123");

    await OpencomSDK.sendMessage("conversation_1" as any, "Hello");
    expect(sendMessage).toHaveBeenCalledWith({
      conversationId: "conversation_1",
      visitorId: "visitor_123",
      sessionToken: "wst_test123",
      content: "Hello",
    });
  });
});
