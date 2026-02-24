import type { GenericDatabaseReader } from "convex/server";
import type { DataModel } from "../_generated/dataModel";

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const MAX_SLUG_ATTEMPTS = 100;

export async function ensureUniqueSlug(
  db: GenericDatabaseReader<DataModel>,
  table: "articles" | "collections",
  workspaceId: string,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  for (let counter = 1; counter <= MAX_SLUG_ATTEMPTS; counter++) {
    const existing = await db
      .query(table)
      .withIndex("by_slug", (q: any) => q.eq("workspaceId", workspaceId).eq("slug", slug))
      .first();
    if (!existing || (excludeId && existing._id === excludeId)) return slug;
    slug = `${baseSlug}-${counter}`;
  }
  throw new Error(`Could not generate unique slug after ${MAX_SLUG_ATTEMPTS} attempts`);
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}
