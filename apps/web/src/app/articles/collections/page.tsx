"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";
import { appConfirm } from "@/lib/appConfirm";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Input } from "@opencom/ui";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  FolderOpen,
  CornerDownRight,
  CircleAlert,
  CheckCircle2,
  Info,
} from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";

interface CollectionFormData {
  name: string;
  description: string;
  icon: string;
  parentId: Id<"collections"> | "";
}

type NoticeTone = "info" | "success" | "warning" | "error";
type PageNotice = {
  tone: NoticeTone;
  message: string;
};

const ROOT_COLLECTION_KEY = "__root__";

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
};

const getFriendlyCollectionError = (error: unknown) => {
  const message = getErrorMessage(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("child collections")) {
    return "This collection has child collections. Move or delete those child collections first.";
  }
  if (normalized.includes("with articles")) {
    return "This collection still has articles. Move or delete those articles first.";
  }
  if (normalized.includes("its own parent")) {
    return "A collection cannot be set as its own parent.";
  }
  if (normalized.includes("own descendant")) {
    return "A collection cannot be moved into one of its own child collections.";
  }

  return message;
};

export default function CollectionsPage() {
  const { activeWorkspace } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"collections"> | null>(null);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const [formData, setFormData] = useState<CollectionFormData>({
    name: "",
    description: "",
    icon: "",
    parentId: "",
  });

  const listHierarchyQuery = makeFunctionReference<
    "query",
    { workspaceId: Id<"workspaces"> },
    Array<{
      _id: Id<"collections">;
      name: string;
      description?: string;
      icon?: string;
      parentId?: Id<"collections">;
      articleCount?: number;
      order: number;
    }>
  >("collections:listHierarchy");
  const createCollectionRef = makeFunctionReference<"mutation", any, Id<"collections">>(
    "collections:create"
  );
  const updateCollectionRef = makeFunctionReference<"mutation", any, unknown>(
    "collections:update"
  );
  const deleteCollectionRef = makeFunctionReference<"mutation", { id: Id<"collections"> }, unknown>(
    "collections:remove"
  );

  const collections = useQuery(
    listHierarchyQuery,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const createCollection = useMutation(createCollectionRef);
  const updateCollection = useMutation(updateCollectionRef);
  const deleteCollection = useMutation(deleteCollectionRef);

  type CollectionItem = NonNullable<typeof collections>[number];
  type FlattenedCollectionRow = {
    collection: CollectionItem;
    depth: number;
    path: string;
    parentName: string;
    childCount: number;
  };

  const collectionItems = collections ?? [];
  const collectionMap = new Map(
    collectionItems.map((collection: CollectionItem) => [collection._id, collection] as const)
  );

  const childrenByParent = new Map<string, CollectionItem[]>();
  const childCountByCollectionId = new Map<string, number>();

  for (const collection of collectionItems) {
    const parentKey = collection.parentId ?? ROOT_COLLECTION_KEY;
    const siblings = childrenByParent.get(parentKey);
    if (siblings) {
      siblings.push(collection);
    } else {
      childrenByParent.set(parentKey, [collection]);
    }

    if (collection.parentId) {
      childCountByCollectionId.set(
        collection.parentId,
        (childCountByCollectionId.get(collection.parentId) ?? 0) + 1
      );
    }
  }

  for (const siblings of childrenByParent.values()) {
    siblings.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }

  const getCollectionPath = (collectionId: Id<"collections">) => {
    const path: string[] = [];
    const seen = new Set<string>();
    let cursor: Id<"collections"> | undefined = collectionId;

    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const collection = collectionMap.get(cursor);
      if (!collection) {
        break;
      }
      path.unshift(collection.name);
      cursor = collection.parentId;
    }

    return path.join(" / ");
  };

  const flattenedCollections: FlattenedCollectionRow[] = [];
  const visitedCollectionIds = new Set<string>();

  const walkTree = (parentId: Id<"collections"> | undefined, depth: number) => {
    const parentKey = parentId ?? ROOT_COLLECTION_KEY;
    const children = childrenByParent.get(parentKey) ?? [];

    for (const child of children) {
      if (visitedCollectionIds.has(child._id)) {
        continue;
      }
      visitedCollectionIds.add(child._id);
      flattenedCollections.push({
        collection: child,
        depth,
        path: getCollectionPath(child._id),
        parentName: child.parentId ? collectionMap.get(child.parentId)?.name ?? "Unknown" : "Root",
        childCount: childCountByCollectionId.get(child._id) ?? 0,
      });
      walkTree(child._id, depth + 1);
    }
  };

  walkTree(undefined, 0);

  // Guard against malformed parent relationships by rendering any leftovers.
  for (const collection of collectionItems) {
    if (visitedCollectionIds.has(collection._id)) {
      continue;
    }
    flattenedCollections.push({
      collection,
      depth: 0,
      path: getCollectionPath(collection._id) || collection.name,
      parentName: collection.parentId ? collectionMap.get(collection.parentId)?.name ?? "Unknown" : "Root",
      childCount: childCountByCollectionId.get(collection._id) ?? 0,
    });
  }

  const getDescendantCollectionIds = (collectionId: Id<"collections">) => {
    const descendants = new Set<string>();
    const stack: Id<"collections">[] = [collectionId];

    while (stack.length > 0) {
      const currentId = stack.pop();
      if (!currentId) {
        continue;
      }
      const children = childrenByParent.get(currentId) ?? [];
      for (const child of children) {
        if (descendants.has(child._id)) {
          continue;
        }
        descendants.add(child._id);
        stack.push(child._id);
      }
    }

    return descendants;
  };

  const blockedParentIds = new Set<string>();
  if (editingId) {
    blockedParentIds.add(editingId);
    const descendants = getDescendantCollectionIds(editingId);
    for (const descendantId of descendants) {
      blockedParentIds.add(descendantId);
    }
  }
  const availableParentRows = flattenedCollections.filter(
    (row) => !blockedParentIds.has(row.collection._id)
  );

  const handleOpenModal = (collection?: NonNullable<typeof collections>[number]) => {
    setNotice(null);
    if (collection) {
      setEditingId(collection._id);
      setFormData({
        name: collection.name,
        description: collection.description || "",
        icon: collection.icon || "",
        parentId: collection.parentId ?? "",
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", description: "", icon: "", parentId: "" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: "", description: "", icon: "", parentId: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?._id) return;
    setNotice(null);

    try {
      if (editingId) {
        await updateCollection({
          id: editingId,
          name: formData.name,
          description: formData.description || undefined,
          icon: formData.icon || undefined,
          parentId: formData.parentId || null,
        });
      } else {
        await createCollection({
          workspaceId: activeWorkspace._id,
          name: formData.name,
          description: formData.description || undefined,
          icon: formData.icon || undefined,
          parentId: formData.parentId || undefined,
        });
      }
      setNotice({
        tone: "success",
        message: editingId ? "Collection updated." : "Collection created.",
      });
      handleCloseModal();
    } catch (error) {
      setNotice({
        tone: "error",
        message: getFriendlyCollectionError(error),
      });
    }
  };

  const handleDelete = async (collection: CollectionItem) => {
    const childCount = childCountByCollectionId.get(collection._id) ?? 0;
    if (childCount > 0) {
      setNotice({
        tone: "warning",
        message: `"${collection.name}" has ${childCount} child collection${
          childCount !== 1 ? "s" : ""
        }. Move or delete child collections first.`,
      });
      return;
    }

    const articleCount = collection.articleCount ?? 0;

    if (articleCount > 0) {
      setNotice({
        tone: "warning",
        message: `"${collection.name}" still has ${articleCount} article${
          articleCount !== 1 ? "s" : ""
        }. Move or delete those articles first.`,
      });
      return;
    }

    if (await appConfirm(`Delete "${collection.name}"? This cannot be undone.`)) {
      setNotice(null);
      try {
        await deleteCollection({ id: collection._id });
        setNotice({
          tone: "info",
          message: `Collection "${collection.name}" deleted.`,
        });
      } catch (error) {
        setNotice({
          tone: "error",
          message: getFriendlyCollectionError(error),
        });
      }
    }
  };

  const noticeToneClassNames: Record<NoticeTone, string> = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-green-200 bg-green-50 text-green-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    error: "border-red-200 bg-red-50 text-red-800",
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/articles">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Articles
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Collections</h1>
            <p className="text-gray-500">Organize your articles into categories</p>
          </div>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          New Collection
        </Button>
      </div>

      {notice && (
        <div
          className={`mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${noticeToneClassNames[notice.tone]}`}
        >
          {notice.tone === "success" ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          ) : notice.tone === "error" ? (
            <CircleAlert className="h-4 w-4 mt-0.5 shrink-0" />
          ) : (
            <Info className="h-4 w-4 mt-0.5 shrink-0" />
          )}
          <p>{notice.message}</p>
        </div>
      )}

      {collections?.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <FolderOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No collections yet</h3>
          <p className="text-gray-500 mb-4">Create collections to organize your articles</p>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Collection
          </Button>
        </div>
      ) : (
        <div className="border rounded-lg bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                    Collection
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Parent</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Children</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Articles</th>
                  <th className="px-4 py-3 w-[120px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {flattenedCollections.map((row) => (
                  <tr key={row.collection._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div
                        className="flex items-start gap-3"
                        style={{ paddingLeft: `${row.depth * 20}px` }}
                      >
                        {row.depth > 0 && (
                          <CornerDownRight className="h-4 w-4 mt-1 text-gray-400 shrink-0" />
                        )}
                        <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-base shrink-0">
                          {row.collection.icon || "📁"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{row.collection.name}</p>
                          <p className="text-xs text-gray-500 truncate">{row.path}</p>
                          {row.collection.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {row.collection.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.parentName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.childCount}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.collection.articleCount}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(row.collection)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(row.collection)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? "Edit Collection" : "New Collection"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Collection name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parent Collection
                </label>
                <select
                  value={formData.parentId}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      parentId: e.target.value as Id<"collections"> | "",
                    })
                  }
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Root</option>
                  {availableParentRows.map((row) => (
                    <option key={row.collection._id} value={row.collection._id}>
                      {row.path}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Choose Root for a top-level collection.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
                <Input
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="📁"
                  maxLength={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit">{editingId ? "Save Changes" : "Create Collection"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
