import { Id } from "../../convex/_generated/dataModel";

type ConversationStatus = "open" | "closed" | "snoozed";
type SenderType = "visitor" | "agent" | "bot";

export type InboxFixtureConversation = {
  _id: Id<"conversations">;
  workspaceId: Id<"workspaces">;
  visitorId: Id<"visitors">;
  status: ConversationStatus;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
  unreadByAgent: number;
  unreadByVisitor: number;
};

export type InboxFixtureMessage = {
  _id: Id<"messages">;
  conversationId: Id<"conversations">;
  senderId: string;
  senderType: SenderType;
  content: string;
  createdAt: number;
};

function fixtureId<T extends string>(prefix: T, index: number): Id<any> {
  return `${prefix}_${String(index).padStart(4, "0")}` as Id<any>;
}

export function buildInboxFixture(options?: {
  workspaceId?: Id<"workspaces">;
  conversationCount?: number;
  startingTimestamp?: number;
}): {
  workspaceId: Id<"workspaces">;
  conversations: InboxFixtureConversation[];
  messages: InboxFixtureMessage[];
} {
  const workspaceId = options?.workspaceId ?? ("workspace_inbox_fixture" as Id<"workspaces">);
  const conversationCount = options?.conversationCount ?? 12;
  const startingTimestamp = options?.startingTimestamp ?? 1_700_000_000_000;

  const conversations: InboxFixtureConversation[] = [];
  const messages: InboxFixtureMessage[] = [];

  for (let index = 0; index < conversationCount; index += 1) {
    const createdAt = startingTimestamp + index * 1_000;
    const lastMessageAt = createdAt + 500;
    const conversationId = fixtureId("conversation", index) as Id<"conversations">;
    const visitorId = fixtureId("visitor", index) as Id<"visitors">;

    conversations.push({
      _id: conversationId,
      workspaceId,
      visitorId,
      status: index % 5 === 0 ? "snoozed" : index % 3 === 0 ? "closed" : "open",
      createdAt,
      updatedAt: lastMessageAt,
      lastMessageAt,
      unreadByAgent: index % 4,
      unreadByVisitor: (index + 1) % 3,
    });

    messages.push({
      _id: fixtureId("message", index),
      conversationId,
      senderId: index % 2 === 0 ? visitorId : fixtureId("user", index),
      senderType: index % 2 === 0 ? "visitor" : "agent",
      content: `Fixture message ${index}`,
      createdAt: lastMessageAt,
    });
  }

  return { workspaceId, conversations, messages };
}

export function buildCrossWorkspaceConversations(
  primaryWorkspaceId: Id<"workspaces">,
  secondaryWorkspaceId: Id<"workspaces">
): InboxFixtureConversation[] {
  const primary = buildInboxFixture({
    workspaceId: primaryWorkspaceId,
    conversationCount: 6,
    startingTimestamp: 1_700_000_010_000,
  }).conversations;
  const secondary = buildInboxFixture({
    workspaceId: secondaryWorkspaceId,
    conversationCount: 4,
    startingTimestamp: 1_700_000_020_000,
  }).conversations;
  return [...primary, ...secondary];
}
