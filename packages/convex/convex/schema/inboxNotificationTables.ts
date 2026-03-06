import { inboxConversationTables } from "./inboxConversationTables";
import { inboxNotificationRoutingTables } from "./inboxNotificationRoutingTables";
import { inboxPushTokenTables } from "./inboxPushTokenTables";

export const inboxNotificationTables = {
  ...inboxConversationTables,
  ...inboxPushTokenTables,
  ...inboxNotificationRoutingTables,
};
