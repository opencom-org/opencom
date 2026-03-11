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

export type CollectionHierarchyItem = {
  _id: Id<"collections">;
  name: string;
  description?: string;
  icon?: string;
  parentId?: Id<"collections">;
  articleCount?: number;
  order: number;
};

type CreateCollectionArgs = WorkspaceArgs & {
  name: string;
  description?: string;
  icon?: string;
  parentId?: Id<"collections">;
};

type UpdateCollectionArgs = {
  id: Id<"collections">;
  name: string;
  description?: string;
  icon?: string;
  parentId: Id<"collections"> | null;
};

type DeleteCollectionArgs = {
  id: Id<"collections">;
};

const LIST_HIERARCHY_QUERY_REF = webQueryRef<WorkspaceArgs, CollectionHierarchyItem[]>(
  "collections:listHierarchy"
);
const CREATE_COLLECTION_REF = webMutationRef<CreateCollectionArgs, Id<"collections">>(
  "collections:create"
);
const UPDATE_COLLECTION_REF = webMutationRef<UpdateCollectionArgs, null>("collections:update");
const DELETE_COLLECTION_REF = webMutationRef<DeleteCollectionArgs, null>("collections:remove");

export function useArticleCollectionsConvex(workspaceId?: Id<"workspaces"> | null) {
  return {
    collections: useWebQuery(LIST_HIERARCHY_QUERY_REF, workspaceId ? { workspaceId } : "skip"),
    createCollection: useWebMutation(CREATE_COLLECTION_REF),
    deleteCollection: useWebMutation(DELETE_COLLECTION_REF),
    updateCollection: useWebMutation(UPDATE_COLLECTION_REF),
  };
}
