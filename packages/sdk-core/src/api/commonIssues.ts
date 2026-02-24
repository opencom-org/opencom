import { api } from "@opencom/convex";
import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";

export type CommonIssueButtonId = Id<"commonIssueButtons">;

export interface CommonIssueButton {
  _id: CommonIssueButtonId;
  workspaceId: Id<"workspaces">;
  label: string;
  action: "article" | "start_conversation";
  articleId?: Id<"articles">;
  conversationStarter?: string;
  order: number;
  enabled: boolean;
  article?: {
    _id: Id<"articles">;
    title: string;
    slug: string;
  } | null;
}

export async function getCommonIssueButtons(): Promise<CommonIssueButton[]> {
  const client = getClient();
  const config = getConfig();

  const buttons = await client.query(api.commonIssueButtons.list, {
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return buttons as CommonIssueButton[];
}
