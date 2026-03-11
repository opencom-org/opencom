import { defineSchema } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { authWorkspaceTables } from "./schema/authWorkspaceTables";
import { campaignTables } from "./schema/campaignTables";
import { engagementTables } from "./schema/engagementTables";
import { helpCenterTables } from "./schema/helpCenterTables";
import { inboxNotificationTables } from "./schema/inboxNotificationTables";
import { operationsTables } from "./schema/operationsTables";
import { outboundSupportTables } from "./schema/outboundSupportTables";

export default defineSchema({
  ...authTables,
  ...authWorkspaceTables,
  ...inboxNotificationTables,
  ...helpCenterTables,
  ...engagementTables,
  ...outboundSupportTables,
  ...campaignTables,
  ...operationsTables,
});
