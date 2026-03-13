"use client";

import type { Id } from "@opencom/convex/dataModel";
import {
  useWebMutation,
  useWebQuery,
  webMutationRef,
  webQueryRef,
} from "@/lib/convex/hooks";

type WorkspaceArgs = {
  workspaceId: Id<"workspaces">;
};

type CreateSnippetArgs = WorkspaceArgs & {
  name: string;
  content: string;
  shortcut?: string;
};

type UpdateSnippetArgs = {
  id: Id<"snippets">;
  name?: string;
  content?: string;
  shortcut?: string;
};

type DeleteSnippetArgs = {
  id: Id<"snippets">;
};

const SNIPPETS_LIST_QUERY_REF = webQueryRef<
  WorkspaceArgs,
  Array<{
    _id: Id<"snippets">;
    name: string;
    content: string;
    shortcut?: string;
  }>
>("snippets:list");
const CREATE_SNIPPET_REF = webMutationRef<CreateSnippetArgs, Id<"snippets">>("snippets:create");
const UPDATE_SNIPPET_REF = webMutationRef<UpdateSnippetArgs, null>("snippets:update");
const DELETE_SNIPPET_REF = webMutationRef<DeleteSnippetArgs, null>("snippets:remove");

export function useSnippetsPageConvex(workspaceId?: Id<"workspaces"> | null) {
  return {
    createSnippet: useWebMutation(CREATE_SNIPPET_REF),
    deleteSnippet: useWebMutation(DELETE_SNIPPET_REF),
    snippets: useWebQuery(SNIPPETS_LIST_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    updateSnippet: useWebMutation(UPDATE_SNIPPET_REF),
  };
}
