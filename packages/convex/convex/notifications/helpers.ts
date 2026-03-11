import type { Doc, Id } from "../_generated/dataModel";
import {
  ADMIN_WEB_APP_BASE_URL,
  EMAIL_DEBOUNCE_MS,
  MAX_BATCH_MESSAGES,
  NotifyNewMessageMode,
} from "./contracts";

export function truncatePreview(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

export function buildDefaultEventKey(args: {
  eventType: string;
  conversationId?: Id<"conversations">;
  ticketId?: Id<"tickets">;
  outboundMessageId?: Id<"outboundMessages">;
  campaignId?: Id<"pushCampaigns">;
  actorUserId?: Id<"users">;
  actorVisitorId?: Id<"visitors">;
}): string {
  const primaryId =
    args.conversationId ?? args.ticketId ?? args.outboundMessageId ?? args.campaignId ?? "none";
  const actorId = args.actorUserId ?? args.actorVisitorId ?? "system";
  return `${args.eventType}:${String(primaryId)}:${String(actorId)}:${Date.now()}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizeHttpUrl(value: string | null | undefined): string | null {
  const rawValue = value?.trim();
  if (!rawValue) {
    return null;
  }

  try {
    const url = new URL(rawValue);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function buildAdminConversationInboxUrl(conversationId: Id<"conversations">): string | null {
  const normalizedBaseUrl = normalizeHttpUrl(ADMIN_WEB_APP_BASE_URL);
  if (!normalizedBaseUrl) {
    return null;
  }

  try {
    const url = new URL(normalizedBaseUrl);
    url.pathname = "/inbox";
    url.search = "";
    url.searchParams.set("conversationId", conversationId);
    return url.toString();
  } catch {
    return null;
  }
}

export function formatEmailTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d{3}Z$/, " UTC");
}

export function renderMetadataList(
  metadata: Array<{ label: string; value: string | null | undefined }>
): string {
  const items = metadata
    .filter((entry) => entry.value && entry.value.trim().length > 0)
    .map(
      (entry) => `<li><strong>${escapeHtml(entry.label)}:</strong> ${escapeHtml(entry.value!)}</li>`
    );

  if (items.length === 0) {
    return "";
  }

  return `<ul>${items.join("")}</ul>`;
}

export function truncateText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export function formatMessageContentForEmail(content: string): string {
  return escapeHtml(truncateText(content, 600)).replace(/\n/g, "<br />");
}

export function getSupportSenderLabel(
  message: Doc<"messages">,
  supportSenderLabels: Map<string, string>
): string {
  if (message.senderType === "bot") {
    return "Support bot";
  }
  if (message.senderType === "agent" || message.senderType === "user") {
    return supportSenderLabels.get(message.senderId) ?? "Support";
  }
  return "Support";
}

export function renderConversationThreadHtml(args: {
  messages: Doc<"messages">[];
  newMessageIds: Set<Id<"messages">>;
  visitorLabel: string;
  supportSenderLabels: Map<string, string>;
}): string {
  if (args.messages.length === 0) {
    return "<p>No message content available.</p>";
  }

  const items = args.messages.map((message) => {
    const visitorSide = message.senderType === "visitor";
    const senderLabel = visitorSide
      ? args.visitorLabel
      : getSupportSenderLabel(message, args.supportSenderLabels);
    const createdAt = formatEmailTimestamp(message.createdAt);
    const content = formatMessageContentForEmail(message.content);
    const isNewMessage = args.newMessageIds.has(message._id);
    const bubbleBg = visitorSide ? "#eef2ff" : "#111827";
    const bubbleFg = visitorSide ? "#1f2937" : "#ffffff";

    return `
      <tr>
        <td align="${visitorSide ? "left" : "right"}" style="padding:0 0 10px 0;">
          <div style="display:inline-block;max-width:88%;padding:10px 12px;border-radius:12px;background:${bubbleBg};color:${bubbleFg};">
            <p style="margin:0 0 6px 0;font-size:12px;opacity:0.8;">
              <strong>${escapeHtml(senderLabel)}</strong> · ${escapeHtml(createdAt)}${isNewMessage ? " · New" : ""}
            </p>
            <p style="margin:0;font-size:14px;line-height:1.4;">${content}</p>
          </div>
        </td>
      </tr>
    `;
  });

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${items.join(
    ""
  )}</table>`;
}

export function isSupportSenderType(senderType: string): boolean {
  return senderType === "agent" || senderType === "bot";
}

export function isRelevantMessageForMode(message: Doc<"messages">, mode: NotifyNewMessageMode): boolean {
  if (mode === "send_member_email") {
    return message.senderType === "visitor";
  }

  return isSupportSenderType(message.senderType);
}

export function buildDebouncedEmailBatch(args: {
  recentMessagesDesc: Doc<"messages">[];
  mode: NotifyNewMessageMode;
  triggerMessageId: Id<"messages"> | undefined;
  triggerSentAt: number;
}): Doc<"messages">[] {
  const latestRelevant = args.recentMessagesDesc.find((message) =>
    isRelevantMessageForMode(message, args.mode)
  );

  if (!latestRelevant) {
    return [];
  }

  if (args.triggerMessageId) {
    if (latestRelevant._id !== args.triggerMessageId) {
      return [];
    }
  } else if (latestRelevant.createdAt > args.triggerSentAt) {
    return [];
  }

  const batchDesc: Doc<"messages">[] = [];
  let collecting = false;

  for (const message of args.recentMessagesDesc) {
    if (!collecting) {
      if (message._id !== latestRelevant._id) {
        continue;
      }
      collecting = true;
    }

    if (!isRelevantMessageForMode(message, args.mode)) {
      break;
    }

    if (batchDesc.length > 0) {
      const previousMessage = batchDesc[batchDesc.length - 1];
      if (previousMessage.createdAt - message.createdAt > EMAIL_DEBOUNCE_MS) {
        break;
      }
    }

    batchDesc.push(message);

    if (batchDesc.length >= MAX_BATCH_MESSAGES) {
      break;
    }
  }

  return batchDesc.reverse();
}

export function buildVisitorWebsiteUrl(visitor: Doc<"visitors"> | null): string | null {
  return normalizeHttpUrl(visitor?.currentUrl);
}
