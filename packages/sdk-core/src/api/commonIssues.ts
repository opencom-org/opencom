import type { Id } from "@opencom/convex/dataModel";
import { getClient, getConfig } from "./client";
import { makeFunctionReference, type FunctionReference } from "convex/server";

function getQueryRef(name: string): FunctionReference<"query"> {
  return makeFunctionReference(name) as FunctionReference<"query">;
}

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

  const buttons = await client.query(getQueryRef("commonIssueButtons:list"), {
    workspaceId: config.workspaceId as Id<"workspaces">,
  });

  return buttons as CommonIssueButton[];
}
