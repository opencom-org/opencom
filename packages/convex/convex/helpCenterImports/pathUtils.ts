import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export const MARKDOWN_EXTENSION_REGEX = /\.md(?:own)?$/i;
export const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|webp|avif)$/i;
const ROOT_COLLECTION_MATCH_KEY = "__root__";
export const UNCATEGORIZED_COLLECTION_PATH = "uncategorized";
export const ASSET_REFERENCE_PREFIX = "oc-asset://";
const SUPPORTED_IMPORT_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);
export const MAX_IMPORT_IMAGE_BYTES = 5 * 1024 * 1024;

export function isSupportedImportMimeType(mimeType: string | undefined | null): boolean {
  if (!mimeType) {
    return false;
  }
  return SUPPORTED_IMPORT_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

export function normalizePath(path: string): string {
  const normalized = path
    .replace(/\\/g, "/")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return "";
  }
  const segments = normalized.split("/").filter(Boolean);
  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new Error(`Invalid relative path segment "${segment}"`);
    }
  }
  return segments.join("/");
}

export function normalizeSourceKey(sourceKey: string): string {
  return sourceKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeMatchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildCollectionNameMatchKey(
  parentId: Id<"collections"> | undefined,
  name: string
): string {
  return `${parentId ?? ROOT_COLLECTION_MATCH_KEY}::${normalizeMatchText(name)}`;
}

export function buildArticleTitleMatchKey(
  collectionId: Id<"collections"> | undefined,
  title: string
): string {
  return `${collectionId ?? ROOT_COLLECTION_MATCH_KEY}::${normalizeMatchText(title)}`;
}

export function buildArticleSlugMatchKey(
  collectionId: Id<"collections"> | undefined,
  slug: string
): string {
  return `${collectionId ?? ROOT_COLLECTION_MATCH_KEY}::${normalizeSourceKey(slug)}`;
}

export function addMapArrayValue<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
    return;
  }
  map.set(key, [value]);
}

export function buildDefaultSourceKey(
  sourceName: string,
  rootCollectionId?: Id<"collections">
): string {
  const normalizedName = normalizeSourceKey(sourceName) || "import";
  const collectionScope = rootCollectionId ? `collection:${rootCollectionId}` : "collection:root";
  return `${collectionScope}:${normalizedName}`;
}

export function getParentPath(path: string): string | undefined {
  const index = path.lastIndexOf("/");
  if (index === -1) {
    return undefined;
  }
  return path.slice(0, index);
}

export function getDirectoryPath(filePath: string): string | undefined {
  const parentPath = getParentPath(filePath);
  return parentPath && parentPath.length > 0 ? parentPath : undefined;
}

export function getFileName(path: string): string {
  const index = path.lastIndexOf("/");
  if (index === -1) {
    return path;
  }
  return path.slice(index + 1);
}

export function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  if (index === -1) {
    return "";
  }
  return fileName.slice(index).toLowerCase();
}

export function withoutMarkdownExtension(fileName: string): string {
  return fileName.replace(/\.md(?:own)?$/i, "");
}

export function humanizeName(raw: string): string {
  if (!raw) {
    return "Untitled";
  }
  const words = raw
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]?.toUpperCase() + word.slice(1));
  return words.length > 0 ? words.join(" ") : "Untitled";
}

export function pathDepth(path: string): number {
  return path.split("/").length;
}

export function getFirstPathSegment(path: string): string {
  const index = path.indexOf("/");
  return index === -1 ? path : path.slice(0, index);
}

export function stripFirstPathSegment(path: string): string | null {
  const index = path.indexOf("/");
  if (index === -1) {
    return null;
  }
  return path.slice(index + 1);
}

export function detectCommonRootFolder(paths: string[]): string | null {
  if (paths.length === 0) {
    return null;
  }
  const firstSegments = new Set(paths.map(getFirstPathSegment).filter(Boolean));
  const allNested = paths.every((path) => path.includes("/"));
  if (firstSegments.size !== 1 || !allNested) {
    return null;
  }
  return paths[0]!.split("/")[0]!;
}

export function stripSpecificRootFolder(path: string, rootFolder: string): string {
  if (path === rootFolder) {
    return "";
  }
  const prefix = `${rootFolder}/`;
  if (path.startsWith(prefix)) {
    return path.slice(prefix.length);
  }
  return path;
}

export function sanitizePathSegment(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "-")
    .split("")
    .map((char) => (char.charCodeAt(0) < 32 ? "-" : char))
    .join("")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function ensureMarkdownPath(path: string): string {
  return MARKDOWN_EXTENSION_REGEX.test(path) ? path : `${path}.md`;
}

export function dedupePath(path: string, usedPaths: Set<string>): string {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  const extensionIndex = path.lastIndexOf(".");
  const hasExtension = extensionIndex > -1 && extensionIndex < path.length - 1;
  const basePath = hasExtension ? path.slice(0, extensionIndex) : path;
  const extension = hasExtension ? path.slice(extensionIndex) : "";

  let attempt = 2;
  while (attempt < 10_000) {
    const candidate = `${basePath}-${attempt}${extension}`;
    if (!usedPaths.has(candidate)) {
      usedPaths.add(candidate);
      return candidate;
    }
    attempt += 1;
  }

  throw new Error(`Failed to create unique export path for "${path}"`);
}

export function dedupeRelativePath(path: string, usedPaths: Set<string>): string {
  const normalized = ensureMarkdownPath(path);
  return dedupePath(normalized, usedPaths);
}

export function getRelativePath(fromPath: string, toPath: string): string {
  const fromDirSegments = (getDirectoryPath(fromPath) ?? "").split("/").filter(Boolean);
  const toSegments = toPath.split("/").filter(Boolean);

  let sharedPrefixLength = 0;
  const maxShared = Math.min(fromDirSegments.length, toSegments.length);
  while (
    sharedPrefixLength < maxShared &&
    fromDirSegments[sharedPrefixLength] === toSegments[sharedPrefixLength]
  ) {
    sharedPrefixLength += 1;
  }

  const upSegments = fromDirSegments.slice(sharedPrefixLength).map(() => "..");
  const downSegments = toSegments.slice(sharedPrefixLength);
  const parts = [...upSegments, ...downSegments];
  return parts.length > 0 ? parts.join("/") : ".";
}

function yamlQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
}

export function buildFrontmatterContent(args: {
  title: string;
  slug: string;
  status: "draft" | "published";
  updatedAt: number;
  collectionPath?: string;
  sourceName?: string;
  body: string;
}): string {
  const lines = [
    "---",
    `title: ${yamlQuote(args.title)}`,
    `slug: ${yamlQuote(args.slug)}`,
    `status: ${args.status}`,
    `updatedAt: ${yamlQuote(new Date(args.updatedAt).toISOString())}`,
  ];

  if (args.collectionPath) {
    lines.push(`collectionPath: ${yamlQuote(args.collectionPath)}`);
  }
  if (args.sourceName) {
    lines.push(`source: ${yamlQuote(args.sourceName)}`);
  }

  lines.push("---", "", args.body);
  return lines.join("\n");
}

export function addDirectoryAndParents(pathSet: Set<string>, directoryPath: string) {
  let cursor: string | undefined = directoryPath;
  while (cursor) {
    pathSet.add(cursor);
    cursor = getParentPath(cursor);
  }
}

export function pushPreviewPath(list: string[], path: string, maxEntries = 200): void {
  if (list.length >= maxEntries) {
    return;
  }
  list.push(path);
}

type DbCtx = Pick<MutationCtx, "db">;

export async function getNextCollectionOrder(
  ctx: DbCtx,
  workspaceId: Id<"workspaces">,
  parentId: Id<"collections"> | undefined
): Promise<number> {
  const siblings = await ctx.db
    .query("collections")
    .withIndex("by_parent", (q) => q.eq("workspaceId", workspaceId).eq("parentId", parentId))
    .collect();
  return siblings.reduce((max, sibling) => Math.max(max, sibling.order), 0) + 1;
}

export async function getNextArticleOrder(
  ctx: DbCtx,
  collectionId: Id<"collections"> | undefined
): Promise<number> {
  const siblings = await ctx.db
    .query("articles")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  return siblings.reduce((max, sibling) => Math.max(max, sibling.order), 0) + 1;
}

export function formatSourceLabel(sourceName: string, rootCollectionId?: Id<"collections">): string {
  return rootCollectionId ? `${sourceName} (${rootCollectionId})` : sourceName;
}
