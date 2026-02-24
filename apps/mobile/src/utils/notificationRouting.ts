export type NotificationPayload = Record<string, unknown> | undefined;
export type NotificationNavigationTarget =
  | {
      pathname: "/conversation/[id]";
      params: { id: string };
    }
  | {
      pathname: "/inbox";
      params: { ticketId: string };
    };

export function getActiveConversationIdFromPath(
  pathname: string | null | undefined
): string | null {
  if (!pathname) {
    return null;
  }
  const match = pathname.match(/\/conversation\/([^/?#]+)/);
  return match?.[1] ?? null;
}

export function getConversationIdFromPayload(payload: NotificationPayload): string | null {
  return typeof payload?.conversationId === "string" ? payload.conversationId : null;
}

export function shouldSuppressForegroundNotification(args: {
  payload: NotificationPayload;
  activeConversationId: string | null;
}): boolean {
  const payloadConversationId = getConversationIdFromPayload(args.payload);
  return Boolean(
    payloadConversationId &&
    args.activeConversationId &&
    payloadConversationId === args.activeConversationId
  );
}

export function getNotificationNavigationTarget(
  payload: NotificationPayload
): NotificationNavigationTarget | null {
  const conversationId = getConversationIdFromPayload(payload);
  if (conversationId) {
    return {
      pathname: "/conversation/[id]",
      params: { id: conversationId },
    };
  }

  if (typeof payload?.ticketId === "string") {
    return {
      pathname: "/inbox",
      params: { ticketId: payload.ticketId },
    };
  }

  return null;
}
