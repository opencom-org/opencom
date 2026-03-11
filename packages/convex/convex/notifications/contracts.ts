import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";

export const notificationEventTypeValidator = v.union(
  v.literal("chat_message"),
  v.literal("new_conversation"),
  v.literal("assignment"),
  v.literal("ticket_created"),
  v.literal("ticket_status_changed"),
  v.literal("ticket_assigned"),
  v.literal("ticket_comment"),
  v.literal("ticket_customer_reply"),
  v.literal("ticket_resolved"),
  v.literal("outbound_message"),
  v.literal("carousel_trigger"),
  v.literal("push_campaign")
);

export const notificationDomainValidator = v.union(
  v.literal("chat"),
  v.literal("ticket"),
  v.literal("outbound"),
  v.literal("campaign")
);

export const notificationAudienceValidator = v.union(
  v.literal("agent"),
  v.literal("visitor"),
  v.literal("both")
);

export const notificationActorTypeValidator = v.union(
  v.literal("agent"),
  v.literal("visitor"),
  v.literal("bot"),
  v.literal("system")
);

export const notificationChannelValidator = v.union(
  v.literal("push"),
  v.literal("email"),
  v.literal("web"),
  v.literal("widget")
);

export const notificationRecipientTypeValidator = v.union(v.literal("agent"), v.literal("visitor"));

export type NotificationRecipientType = "agent" | "visitor";

export type NotificationPushAttempt = {
  dedupeKey: string;
  recipientType: NotificationRecipientType;
  userId?: Id<"users">;
  visitorId?: Id<"visitors">;
  tokens: string[];
};

export type NotifyNewMessageMode = "send_member_email" | "send_visitor_email";

export const ADMIN_WEB_APP_BASE_URL =
  process.env.OPENCOM_WEB_APP_URL ?? process.env.NEXT_PUBLIC_OPENCOM_WEB_APP_URL ?? "";
export const EMAIL_DEBOUNCE_MS = 60_000;
export const MAX_BATCH_MESSAGES = 8;
export const MAX_THREAD_MESSAGES = 12;
