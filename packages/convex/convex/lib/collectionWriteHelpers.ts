import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { generateSlug, ensureUniqueSlug } from "../utils/strings";

// ── createCollectionCore ────────────────────────────────────────────

export async function createCollectionCore(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    name: string;
    description?: string;
    icon?: string;
    parentId?: Id<"collections">;
  }
): Promise<Id<"collections">> {
  // Validate parent ownership
  if (args.parentId) {
    const parent = await ctx.db.get(args.parentId);
    if (!parent || parent.workspaceId !== args.workspaceId) {
      throw new Error("Parent collection not found");
    }
  }

  const now = Date.now();
  const baseSlug = generateSlug(args.name);
  const slug = await ensureUniqueSlug(ctx.db, "collections", args.workspaceId, baseSlug);

  const collections = await ctx.db
    .query("collections")
    .withIndex("by_parent", (q) =>
      q.eq("workspaceId", args.workspaceId).eq("parentId", args.parentId)
    )
    .collect();
  const maxOrder = collections.reduce((max, c) => Math.max(max, c.order), 0);

  const collectionId = await ctx.db.insert("collections", {
    workspaceId: args.workspaceId,
    name: args.name,
    slug,
    description: args.description,
    icon: args.icon,
    parentId: args.parentId,
    order: maxOrder + 1,
    createdAt: now,
    updatedAt: now,
  });

  return collectionId;
}

// ── updateCollectionCore ────────────────────────────────────────────

export async function updateCollectionCore(
  ctx: MutationCtx,
  collection: Doc<"collections">,
  args: {
    name?: string;
    description?: string;
    icon?: string;
    parentId?: Id<"collections"> | null;
  }
): Promise<void> {
  const updates: {
    name?: string;
    slug?: string;
    description?: string;
    icon?: string;
    parentId?: Id<"collections"> | undefined;
    updatedAt: number;
  } = {
    updatedAt: Date.now(),
  };

  if (args.name !== undefined && args.name !== collection.name) {
    updates.name = args.name;
    const baseSlug = generateSlug(args.name);
    updates.slug = await ensureUniqueSlug(
      ctx.db,
      "collections",
      collection.workspaceId,
      baseSlug,
      collection._id
    );
  }

  if (args.description !== undefined) {
    updates.description = args.description;
  }

  if (args.icon !== undefined) {
    updates.icon = args.icon;
  }

  if (args.parentId !== undefined) {
    if (args.parentId === collection._id) {
      throw new Error("Collection cannot be its own parent");
    }

    if (args.parentId !== null) {
      const parentCollection = await ctx.db.get(args.parentId);
      if (!parentCollection || parentCollection.workspaceId !== collection.workspaceId) {
        throw new Error("Parent collection not found");
      }

      // Cycle detection: walk ancestor chain
      let cursor: Id<"collections"> | undefined = parentCollection.parentId;
      const seen = new Set<string>([parentCollection._id]);

      while (cursor && !seen.has(cursor)) {
        if (cursor === collection._id) {
          throw new Error("Collection cannot be moved into its own descendant");
        }

        seen.add(cursor);
        const ancestor = await ctx.db.get(cursor);
        if (!ancestor || ancestor.workspaceId !== collection.workspaceId) {
          break;
        }
        cursor = ancestor.parentId;
      }
    }

    updates.parentId = args.parentId ?? undefined;
  }

  await ctx.db.patch(collection._id, updates);
}

// ── deleteCollectionCore ────────────────────────────────────────────

export async function deleteCollectionCore(
  ctx: MutationCtx,
  collection: Doc<"collections">
): Promise<void> {
  const childCollections = await ctx.db
    .query("collections")
    .withIndex("by_parent", (q) =>
      q.eq("workspaceId", collection.workspaceId).eq("parentId", collection._id)
    )
    .collect();

  if (childCollections.length > 0) {
    throw new Error("Cannot delete collection with child collections");
  }

  const articles = await ctx.db
    .query("articles")
    .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
    .collect();

  if (articles.length > 0) {
    throw new Error("Cannot delete collection with articles");
  }

  await ctx.db.delete(collection._id);
}
