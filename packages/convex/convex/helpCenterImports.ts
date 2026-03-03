import { v } from "convex/values";
import { authMutation, authQuery } from "./lib/authWrappers";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { ensureUniqueSlug, generateSlug } from "./utils/strings";

const markdownFileValidator = v.object({
  relativePath: v.string(),
  content: v.string(),
});

const importAssetValidator = v.object({
  relativePath: v.string(),
  storageId: v.optional(v.id("_storage")),
  mimeType: v.optional(v.string()),
  size: v.optional(v.number()),
});

const MARKDOWN_EXTENSION_REGEX = /\.md(?:own)?$/i;
const IMAGE_EXTENSION_REGEX = /\.(png|jpe?g|gif|webp|avif)$/i;
const ROOT_COLLECTION_MATCH_KEY = "__root__";
const UNCATEGORIZED_COLLECTION_PATH = "uncategorized";
const UNCATEGORIZED_COLLECTION_ALIASES = new Set([
  UNCATEGORIZED_COLLECTION_PATH,
  "uncategorised",
]);
const ASSET_REFERENCE_PREFIX = "oc-asset://";
const ASSET_REFERENCE_REGEX = /oc-asset:\/\/([A-Za-z0-9_-]+)/g;
const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
const HTML_IMAGE_REGEX = /<img\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi;
const SUPPORTED_IMPORT_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
]);
const MAX_IMPORT_IMAGE_BYTES = 5 * 1024 * 1024;

function isSupportedImportMimeType(mimeType: string | undefined | null): boolean {
  if (!mimeType) {
    return false;
  }
  return SUPPORTED_IMPORT_IMAGE_MIME_TYPES.has(mimeType.toLowerCase());
}

function normalizePath(path: string): string {
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

function normalizeSourceKey(sourceKey: string): string {
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

function buildCollectionNameMatchKey(
  parentId: Id<"collections"> | undefined,
  name: string
): string {
  return `${parentId ?? ROOT_COLLECTION_MATCH_KEY}::${normalizeMatchText(name)}`;
}

function buildArticleTitleMatchKey(
  collectionId: Id<"collections"> | undefined,
  title: string
): string {
  return `${collectionId ?? ROOT_COLLECTION_MATCH_KEY}::${normalizeMatchText(title)}`;
}

function buildArticleSlugMatchKey(
  collectionId: Id<"collections"> | undefined,
  slug: string
): string {
  return `${collectionId ?? ROOT_COLLECTION_MATCH_KEY}::${normalizeSourceKey(slug)}`;
}

function addMapArrayValue<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
    return;
  }
  map.set(key, [value]);
}

function buildDefaultSourceKey(sourceName: string, rootCollectionId?: Id<"collections">): string {
  const normalizedName = normalizeSourceKey(sourceName) || "import";
  const collectionScope = rootCollectionId ? `collection:${rootCollectionId}` : "collection:root";
  return `${collectionScope}:${normalizedName}`;
}

function getParentPath(path: string): string | undefined {
  const index = path.lastIndexOf("/");
  if (index === -1) {
    return undefined;
  }
  return path.slice(0, index);
}

function getFileName(path: string): string {
  const index = path.lastIndexOf("/");
  if (index === -1) {
    return path;
  }
  return path.slice(index + 1);
}

function getFileExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  if (index === -1) {
    return "";
  }
  return fileName.slice(index).toLowerCase();
}

function withoutMarkdownExtension(fileName: string): string {
  return fileName.replace(/\.md(?:own)?$/i, "");
}

function humanizeName(raw: string): string {
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

function inferTitle(filePath: string, content: string): string {
  const headingMatch = content.match(/^\s*#\s+(.+)$/m);
  if (headingMatch && headingMatch[1]) {
    return headingMatch[1].trim();
  }
  return humanizeName(withoutMarkdownExtension(getFileName(filePath)));
}

function parseFrontmatterValue(rawValue: string): string {
  const value = rawValue.trim();
  if (!value) {
    return "";
  }

  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value) as string;
    } catch {
      return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    }
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }

  return value;
}

function normalizeCollectionPathFromFrontmatter(
  rawValue: string | undefined
): string | null | undefined {
  if (rawValue === undefined) {
    return undefined;
  }

  const collectionPath = rawValue.trim();
  if (!collectionPath) {
    return null;
  }

  const normalized = normalizePath(collectionPath);
  if (!normalized) {
    return null;
  }

  if (UNCATEGORIZED_COLLECTION_ALIASES.has(normalized.toLowerCase())) {
    return null;
  }

  return normalized;
}

function parseMarkdownImportContent(content: string): {
  body: string;
  frontmatterTitle?: string;
  frontmatterSlug?: string;
  frontmatterCollectionPath?: string | null;
} {
  const normalizedContent = content.replace(/^\uFEFF/, "");
  const lines = normalizedContent.split(/\r?\n/);
  if (lines.length < 3 || lines[0]?.trim() !== "---") {
    return { body: normalizedContent };
  }

  let frontmatterEndIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === "---") {
      frontmatterEndIndex = index;
      break;
    }
  }

  if (frontmatterEndIndex === -1) {
    return { body: normalizedContent };
  }

  const frontmatterEntries = new Map<string, string>();
  for (const line of lines.slice(1, frontmatterEndIndex)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = trimmed.slice(separatorIndex + 1);
    frontmatterEntries.set(key, parseFrontmatterValue(rawValue));
  }

  const body = lines
    .slice(frontmatterEndIndex + 1)
    .join("\n")
    .replace(/^\s*\n/, "");
  const frontmatterTitle = frontmatterEntries.get("title")?.trim() || undefined;
  const rawSlug = frontmatterEntries.get("slug");
  const normalizedSlug = rawSlug ? normalizeSourceKey(rawSlug) : "";

  return {
    body,
    frontmatterTitle,
    frontmatterSlug: normalizedSlug || undefined,
    frontmatterCollectionPath: normalizeCollectionPathFromFrontmatter(
      frontmatterEntries.get("collectionpath")
    ),
  };
}

function getDirectoryPath(filePath: string): string | undefined {
  const parentPath = getParentPath(filePath);
  return parentPath && parentPath.length > 0 ? parentPath : undefined;
}

function resolveIncomingCollectionPath(file: {
  relativePath: string;
  frontmatterCollectionPath?: string | null;
}): string | undefined {
  if (file.frontmatterCollectionPath === null) {
    return undefined;
  }
  if (typeof file.frontmatterCollectionPath === "string") {
    return file.frontmatterCollectionPath;
  }
  return getDirectoryPath(file.relativePath);
}

function pathDepth(path: string): number {
  return path.split("/").length;
}

function getFirstPathSegment(path: string): string {
  const index = path.indexOf("/");
  return index === -1 ? path : path.slice(0, index);
}

function stripFirstPathSegment(path: string): string | null {
  const index = path.indexOf("/");
  if (index === -1) {
    return null;
  }
  return path.slice(index + 1);
}

function detectCommonRootFolder(paths: string[]): string | null {
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

function stripSpecificRootFolder(path: string, rootFolder: string): string {
  if (path === rootFolder) {
    return "";
  }
  const prefix = `${rootFolder}/`;
  if (path.startsWith(prefix)) {
    return path.slice(prefix.length);
  }
  return path;
}

function sanitizePathSegment(name: string): string {
  return name
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function ensureMarkdownPath(path: string): string {
  return MARKDOWN_EXTENSION_REGEX.test(path) ? path : `${path}.md`;
}

function dedupePath(path: string, usedPaths: Set<string>): string {
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

function dedupeRelativePath(path: string, usedPaths: Set<string>): string {
  const normalized = ensureMarkdownPath(path);
  return dedupePath(normalized, usedPaths);
}

function extractAssetReferenceIds(markdown: string): string[] {
  const ids = new Set<string>();
  const matches = markdown.matchAll(ASSET_REFERENCE_REGEX);
  for (const match of matches) {
    const id = match[1];
    if (id) {
      ids.add(id);
    }
  }
  return Array.from(ids);
}

function parseMarkdownImageTarget(target: string): {
  path: string;
  suffix: string;
  wrappedInAngles: boolean;
} | null {
  const trimmed = target.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">");
    if (end <= 1) {
      return null;
    }
    return {
      path: trimmed.slice(1, end).trim(),
      suffix: trimmed.slice(end + 1).trim(),
      wrappedInAngles: true,
    };
  }

  const [path, ...suffixParts] = trimmed.split(/\s+/);
  if (!path) {
    return null;
  }
  return {
    path,
    suffix: suffixParts.join(" ").trim(),
    wrappedInAngles: false,
  };
}

function buildMarkdownImageTarget(parsed: {
  path: string;
  suffix: string;
  wrappedInAngles: boolean;
}): string {
  const path = parsed.wrappedInAngles ? `<${parsed.path}>` : parsed.path;
  return parsed.suffix ? `${path} ${parsed.suffix}` : path;
}

function isExternalReference(path: string): boolean {
  const normalized = path.trim().toLowerCase();
  return (
    normalized.startsWith("http://") ||
    normalized.startsWith("https://") ||
    normalized.startsWith("data:") ||
    normalized.startsWith("javascript:") ||
    normalized.startsWith("vbscript:") ||
    normalized.startsWith("//") ||
    normalized.startsWith("#")
  );
}

function resolveReferencePath(markdownPath: string, reference: string): string | null {
  const normalized = reference
    .trim()
    .replace(/\\/g, "/")
    .replace(/^<|>$/g, "");
  if (!normalized || isExternalReference(normalized)) {
    return null;
  }

  const pathWithoutQuery = normalized.split("#")[0]?.split("?")[0] ?? "";
  if (!pathWithoutQuery) {
    return null;
  }

  const baseSegments = (getDirectoryPath(markdownPath) ?? "").split("/").filter(Boolean);
  const referenceSegments = pathWithoutQuery.split("/").filter((segment) => segment.length > 0);
  const resolvedSegments = [...baseSegments];

  for (const segment of referenceSegments) {
    if (segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (resolvedSegments.length === 0) {
        return null;
      }
      resolvedSegments.pop();
      continue;
    }
    resolvedSegments.push(segment);
  }

  return resolvedSegments.join("/");
}

function rewriteMarkdownImageReferences(
  markdownContent: string,
  markdownPath: string,
  assetReferenceByPath: Map<string, string>
): { content: string; unresolvedReferences: string[] } {
  const unresolved = new Set<string>();

  const withMarkdownLinksRewritten = markdownContent.replace(
    MARKDOWN_IMAGE_REGEX,
    (full, alt, target) => {
      const parsed = parseMarkdownImageTarget(target);
      if (!parsed || parsed.path.startsWith(ASSET_REFERENCE_PREFIX) || isExternalReference(parsed.path)) {
        return full;
      }

      const resolvedPath = resolveReferencePath(markdownPath, parsed.path);
      if (!resolvedPath) {
        unresolved.add(`${markdownPath}: ${parsed.path}`);
        return full;
      }

      const assetReference = assetReferenceByPath.get(resolvedPath);
      if (!assetReference) {
        unresolved.add(`${markdownPath}: ${parsed.path}`);
        return full;
      }

      const rewrittenTarget = buildMarkdownImageTarget({
        ...parsed,
        path: assetReference,
      });
      return `![${alt}](${rewrittenTarget})`;
    }
  );

  const withHtmlLinksRewritten = withMarkdownLinksRewritten.replace(
    HTML_IMAGE_REGEX,
    (full, before, quote, src, after) => {
      if (src.startsWith(ASSET_REFERENCE_PREFIX) || isExternalReference(src)) {
        return full;
      }

      const resolvedPath = resolveReferencePath(markdownPath, src);
      if (!resolvedPath) {
        unresolved.add(`${markdownPath}: ${src}`);
        return full;
      }

      const assetReference = assetReferenceByPath.get(resolvedPath);
      if (!assetReference) {
        unresolved.add(`${markdownPath}: ${src}`);
        return full;
      }

      return `<img${before}src=${quote}${assetReference}${quote}${after}>`;
    }
  );

  return {
    content: withHtmlLinksRewritten,
    unresolvedReferences: Array.from(unresolved).sort((a, b) => a.localeCompare(b)),
  };
}

function getRelativePath(fromPath: string, toPath: string): string {
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

function rewriteAssetReferencesForExport(
  markdownContent: string,
  markdownPath: string,
  assetPathById: Map<string, string>
): string {
  return markdownContent.replace(ASSET_REFERENCE_REGEX, (fullMatch, id) => {
    const assetPath = assetPathById.get(id);
    if (!assetPath) {
      return fullMatch;
    }
    return getRelativePath(markdownPath, assetPath);
  });
}

function yamlQuote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
}

function buildFrontmatterContent(args: {
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

function addDirectoryAndParents(pathSet: Set<string>, directoryPath: string) {
  let cursor: string | undefined = directoryPath;
  while (cursor) {
    pathSet.add(cursor);
    cursor = getParentPath(cursor);
  }
}

function pushPreviewPath(list: string[], path: string, maxEntries = 200): void {
  if (list.length >= maxEntries) {
    return;
  }
  list.push(path);
}

type DbCtx = Pick<MutationCtx, "db">;

async function getNextCollectionOrder(
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

async function getNextArticleOrder(
  ctx: DbCtx,
  collectionId: Id<"collections"> | undefined
): Promise<number> {
  const siblings = await ctx.db
    .query("articles")
    .withIndex("by_collection", (q) => q.eq("collectionId", collectionId))
    .collect();
  return siblings.reduce((max, sibling) => Math.max(max, sibling.order), 0) + 1;
}

function formatSourceLabel(sourceName: string, rootCollectionId?: Id<"collections">): string {
  return rootCollectionId ? `${sourceName} (${rootCollectionId})` : sourceName;
}

export const syncMarkdownFolder = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceKey: v.optional(v.string()),
    sourceName: v.string(),
    rootCollectionId: v.optional(v.id("collections")),
    files: v.array(markdownFileValidator),
    assets: v.optional(v.array(importAssetValidator)),
    publishByDefault: v.optional(v.boolean()),
    dryRun: v.optional(v.boolean()),
  },
  permission: "articles.create",
  handler: async (ctx, args) => {
    const now = Date.now();
    const publishByDefault = args.publishByDefault ?? true;
    const dryRun = args.dryRun ?? false;
    const sourceKey = normalizeSourceKey(
      args.sourceKey ?? buildDefaultSourceKey(args.sourceName, args.rootCollectionId)
    );
    if (!sourceKey) {
      throw new Error("Import source key is required");
    }

    if (args.rootCollectionId) {
      const rootCollection = await ctx.db.get(args.rootCollectionId);
      if (!rootCollection || rootCollection.workspaceId !== args.workspaceId) {
        throw new Error("Target collection not found");
      }
    }

    const rawIncomingFiles = args.files
      .map((file) => {
        const parsedContent = parseMarkdownImportContent(file.content);
        return {
          relativePath: normalizePath(file.relativePath),
          content: parsedContent.body,
          frontmatterTitle: parsedContent.frontmatterTitle,
          frontmatterSlug: parsedContent.frontmatterSlug,
          frontmatterCollectionPath: parsedContent.frontmatterCollectionPath,
        };
      })
      .filter((file) => Boolean(file.relativePath) && MARKDOWN_EXTENSION_REGEX.test(file.relativePath));

    if (rawIncomingFiles.length === 0) {
      throw new Error("No markdown files were found in this upload");
    }

    const rawIncomingAssets = (args.assets ?? [])
      .map((asset) => ({
        relativePath: normalizePath(asset.relativePath),
        storageId: asset.storageId,
        mimeType: asset.mimeType,
        size: asset.size,
      }))
      .filter((asset) => Boolean(asset.relativePath) && IMAGE_EXTENSION_REGEX.test(asset.relativePath));

    const commonRootFolder = detectCommonRootFolder(
      [...rawIncomingFiles.map((file) => file.relativePath), ...rawIncomingAssets.map((asset) => asset.relativePath)]
    );

    const incomingFiles = new Map<
      string,
      {
        relativePath: string;
        originalPath: string;
        content: string;
        frontmatterTitle?: string;
        frontmatterSlug?: string;
        frontmatterCollectionPath?: string | null;
      }
    >();
    for (const file of rawIncomingFiles) {
      const normalizedPath = commonRootFolder
        ? stripSpecificRootFolder(file.relativePath, commonRootFolder)
        : file.relativePath;
      if (!normalizedPath) {
        continue;
      }
      if (incomingFiles.has(normalizedPath)) {
        throw new Error(
          `Import contains duplicate markdown path after root normalization: "${normalizedPath}"`
        );
      }
      incomingFiles.set(normalizedPath, {
        relativePath: normalizedPath,
        originalPath: file.relativePath,
        content: file.content,
        frontmatterTitle: file.frontmatterTitle,
        frontmatterSlug: file.frontmatterSlug,
        frontmatterCollectionPath: file.frontmatterCollectionPath,
      });
    }

    if (incomingFiles.size === 0) {
      throw new Error("No markdown files remained after path normalization");
    }

    const incomingAssets = new Map<
      string,
      {
        relativePath: string;
        originalPath: string;
        storageId?: Id<"_storage">;
        mimeType?: string;
        size?: number;
      }
    >();
    for (const asset of rawIncomingAssets) {
      const normalizedPath = commonRootFolder
        ? stripSpecificRootFolder(asset.relativePath, commonRootFolder)
        : asset.relativePath;
      if (!normalizedPath) {
        continue;
      }
      if (incomingAssets.has(normalizedPath)) {
        throw new Error(
          `Import contains duplicate image path after root normalization: "${normalizedPath}"`
        );
      }
      incomingAssets.set(normalizedPath, {
        relativePath: normalizedPath,
        originalPath: asset.relativePath,
        storageId: asset.storageId,
        mimeType: asset.mimeType,
        size: asset.size,
      });
    }

    const existingSource = await ctx.db
      .query("helpCenterImportSources")
      .withIndex("by_workspace_source_key", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("sourceKey", sourceKey)
      )
      .first();
    let sourceId = existingSource?._id;

    if (!sourceId && !dryRun) {
      sourceId = await ctx.db.insert("helpCenterImportSources", {
        workspaceId: args.workspaceId,
        sourceKey,
        sourceName: args.sourceName,
        rootCollectionId: args.rootCollectionId,
        createdAt: now,
        updatedAt: now,
      });
    }

    if (existingSource && !dryRun) {
      await ctx.db.patch(existingSource._id, {
        sourceName: args.sourceName,
        rootCollectionId: args.rootCollectionId,
        updatedAt: now,
      });
    }

    const existingCollections = sourceId
      ? await ctx.db
          .query("collections")
          .withIndex("by_workspace_import_source", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("importSourceId", sourceId!)
          )
          .collect()
      : [];

    const existingArticles = sourceId
      ? await ctx.db
          .query("articles")
          .withIndex("by_workspace_import_source", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("importSourceId", sourceId!)
          )
          .collect()
      : [];

    const existingAssets = sourceId
      ? await ctx.db
          .query("articleAssets")
          .withIndex("by_import_source", (q) => q.eq("importSourceId", sourceId!))
          .collect()
      : [];
    const existingAssetByPath = new Map(
      existingAssets
        .filter((asset) => asset.importPath)
        .map((asset) => [asset.importPath!, asset] as const)
    );
    const assetReferenceByPath = new Map<string, string>();
    for (const existingAsset of existingAssets) {
      if (!existingAsset.importPath) {
        continue;
      }
      assetReferenceByPath.set(
        existingAsset.importPath,
        `${ASSET_REFERENCE_PREFIX}${existingAsset._id}`
      );
    }

    for (const incomingAsset of incomingAssets.values()) {
      const existingAsset = existingAssetByPath.get(incomingAsset.relativePath);

      if (dryRun) {
        const syntheticReference =
          existingAsset
            ? `${ASSET_REFERENCE_PREFIX}${existingAsset._id}`
            : `${ASSET_REFERENCE_PREFIX}dryrun-${normalizeSourceKey(incomingAsset.relativePath) || "asset"}`;
        assetReferenceByPath.set(incomingAsset.relativePath, syntheticReference);
        continue;
      }

      if (!sourceId) {
        throw new Error("Failed to resolve import source");
      }
      if (!incomingAsset.storageId) {
        throw new Error(
          `Image "${incomingAsset.relativePath}" is missing storageId. Upload assets before applying import.`
        );
      }

      const metadata = await ctx.storage.getMetadata(incomingAsset.storageId);
      if (!metadata) {
        throw new Error(`Uploaded image "${incomingAsset.relativePath}" was not found in storage.`);
      }

      const mimeType = (metadata.contentType ?? incomingAsset.mimeType ?? "").toLowerCase();
      if (!isSupportedImportMimeType(mimeType)) {
        throw new Error(
          `Unsupported image type for "${incomingAsset.relativePath}". Allowed: PNG, JPEG, GIF, WEBP, AVIF.`
        );
      }
      if (metadata.size > MAX_IMPORT_IMAGE_BYTES) {
        throw new Error(`Image "${incomingAsset.relativePath}" exceeds the 5MB upload limit.`);
      }

      const nowTimestamp = Date.now();
      if (existingAsset) {
        if (existingAsset.storageId !== incomingAsset.storageId) {
          await ctx.storage.delete(existingAsset.storageId);
        }
        await ctx.db.patch(existingAsset._id, {
          storageId: incomingAsset.storageId,
          fileName: getFileName(incomingAsset.relativePath),
          mimeType,
          size: metadata.size,
          updatedAt: nowTimestamp,
        });
        assetReferenceByPath.set(
          incomingAsset.relativePath,
          `${ASSET_REFERENCE_PREFIX}${existingAsset._id}`
        );
        continue;
      }

      const createdAssetId = await ctx.db.insert("articleAssets", {
        workspaceId: args.workspaceId,
        importSourceId: sourceId,
        importPath: incomingAsset.relativePath,
        storageId: incomingAsset.storageId,
        fileName: getFileName(incomingAsset.relativePath),
        mimeType,
        size: metadata.size,
        createdBy: ctx.user._id,
        createdAt: nowTimestamp,
        updatedAt: nowTimestamp,
      });
      assetReferenceByPath.set(incomingAsset.relativePath, `${ASSET_REFERENCE_PREFIX}${createdAssetId}`);
    }

    const unresolvedImageReferenceSet = new Set<string>();
    for (const [path, file] of incomingFiles.entries()) {
      const rewritten = rewriteMarkdownImageReferences(file.content, path, assetReferenceByPath);
      for (const unresolved of rewritten.unresolvedReferences) {
        unresolvedImageReferenceSet.add(unresolved);
      }
      incomingFiles.set(path, {
        ...file,
        content: rewritten.content,
      });
    }

    const canMatchImportSource = (
      importSourceId: Id<"helpCenterImportSources"> | undefined
    ): boolean => {
      if (!importSourceId) {
        return true;
      }
      if (!sourceId) {
        return false;
      }
      return importSourceId === sourceId;
    };

    const workspaceCollections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const collectionCandidatesByName = new Map<string, (typeof workspaceCollections)[number][]>();
    for (const collection of workspaceCollections) {
      if (!canMatchImportSource(collection.importSourceId)) {
        continue;
      }
      const nameKey = buildCollectionNameMatchKey(collection.parentId, collection.name);
      addMapArrayValue(collectionCandidatesByName, nameKey, collection);
    }

    const workspaceArticles = await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();
    const articleCandidatesByTitle = new Map<string, (typeof workspaceArticles)[number][]>();
    const articleCandidatesBySlug = new Map<string, (typeof workspaceArticles)[number][]>();
    for (const article of workspaceArticles) {
      if (!canMatchImportSource(article.importSourceId)) {
        continue;
      }
      const titleKey = buildArticleTitleMatchKey(article.collectionId, article.title);
      addMapArrayValue(articleCandidatesByTitle, titleKey, article);
      const slugKey = buildArticleSlugMatchKey(article.collectionId, article.slug);
      addMapArrayValue(articleCandidatesBySlug, slugKey, article);
    }

    const incomingTopLevelSegments = new Set(
      Array.from(incomingFiles.keys()).map(getFirstPathSegment).filter(Boolean)
    );

    const existingCollectionByPath = new Map(
      existingCollections
        .filter((collection) => typeof collection.importPath === "string" && collection.importPath)
        .map((collection) => [collection.importPath as string, collection] as const)
    );
    const existingCollectionByStrippedPath = new Map<
      string,
      (typeof existingCollections)[number]
    >();
    for (const collection of existingCollections) {
      if (!collection.importPath) {
        continue;
      }
      const strippedPath = stripFirstPathSegment(collection.importPath);
      if (!strippedPath) {
        continue;
      }
      const firstSegment = getFirstPathSegment(collection.importPath);
      if (incomingTopLevelSegments.has(firstSegment)) {
        continue;
      }
      if (
        !existingCollectionByPath.has(strippedPath) &&
        !existingCollectionByStrippedPath.has(strippedPath)
      ) {
        existingCollectionByStrippedPath.set(strippedPath, collection);
      }
    }

    const existingArticleByPath = new Map(
      existingArticles
        .filter((article) => typeof article.importPath === "string" && article.importPath)
        .map((article) => [article.importPath as string, article] as const)
    );
    const existingArticleByStrippedPath = new Map<string, (typeof existingArticles)[number]>();
    for (const article of existingArticles) {
      if (!article.importPath) {
        continue;
      }
      const strippedPath = stripFirstPathSegment(article.importPath);
      if (!strippedPath) {
        continue;
      }
      const firstSegment = getFirstPathSegment(article.importPath);
      if (incomingTopLevelSegments.has(firstSegment)) {
        continue;
      }
      if (
        !existingArticleByPath.has(strippedPath) &&
        !existingArticleByStrippedPath.has(strippedPath)
      ) {
        existingArticleByStrippedPath.set(strippedPath, article);
      }
    }

    const desiredCollectionPaths = new Set<string>();
    for (const file of incomingFiles.values()) {
      const directoryPath = resolveIncomingCollectionPath(file);
      if (directoryPath) {
        addDirectoryAndParents(desiredCollectionPaths, directoryPath);
      }
    }

    const sortedDesiredCollections = Array.from(desiredCollectionPaths).sort((a, b) => {
      const depthDelta = pathDepth(a) - pathDepth(b);
      if (depthDelta !== 0) {
        return depthDelta;
      }
      return a.localeCompare(b);
    });

    const collectionPathToId = new Map<string, Id<"collections">>();
    for (const [path, collection] of existingCollectionByPath.entries()) {
      collectionPathToId.set(path, collection._id);
    }

    let createdCollections = 0;
    let updatedCollections = 0;
    let createdArticles = 0;
    let updatedArticles = 0;
    let deletedArticles = 0;
    let deletedCollections = 0;
    const createdCollectionPaths: string[] = [];
    const updatedCollectionPaths: string[] = [];
    const deletedCollectionPaths: string[] = [];
    const createdArticlePaths: string[] = [];
    const updatedArticlePaths: string[] = [];
    const deletedArticlePaths: string[] = [];
    const matchedCollectionIds = new Set<Id<"collections">>();
    const matchedArticleIds = new Set<Id<"articles">>();
    const deletedArticleIdsInRun = new Set<Id<"articles">>();
    const deletedCollectionIdsInRun = new Set<Id<"collections">>();

    const rootCollectionPathSentinel = "__root__";
    const existingCollectionPathById = new Map<Id<"collections">, string>();
    for (const collection of existingCollections) {
      if (collection.importPath) {
        existingCollectionPathById.set(collection._id, collection.importPath);
      }
    }
    const getExistingArticleCollectionPath = (
      article: (typeof existingArticles)[number]
    ): string | undefined => {
      if (article.collectionId === args.rootCollectionId) {
        return rootCollectionPathSentinel;
      }
      if (!article.collectionId && !args.rootCollectionId) {
        return rootCollectionPathSentinel;
      }
      if (!article.collectionId) {
        return undefined;
      }
      return existingCollectionPathById.get(article.collectionId);
    };

    for (const collectionPath of sortedDesiredCollections) {
      let existingCollection =
        existingCollectionByPath.get(collectionPath) ??
        existingCollectionByStrippedPath.get(collectionPath);
      const segmentName = collectionPath.split("/").pop() ?? collectionPath;
      const targetName = humanizeName(segmentName);
      const parentPath = getParentPath(collectionPath);
      const expectedParentId = parentPath
        ? collectionPathToId.get(parentPath)
        : args.rootCollectionId;

      if (parentPath && !expectedParentId) {
        throw new Error(`Unable to resolve parent collection for "${collectionPath}"`);
      }

      if (!existingCollection) {
        const matchKey = buildCollectionNameMatchKey(expectedParentId, targetName);
        const nameCandidates =
          collectionCandidatesByName
            .get(matchKey)
            ?.filter((candidate) => !matchedCollectionIds.has(candidate._id)) ?? [];
        if (nameCandidates.length === 1) {
          existingCollection = nameCandidates[0];
        }
      }

      if (existingCollection) {
        const updates: {
          name?: string;
          slug?: string;
          parentId?: Id<"collections">;
          importPath?: string;
          importSourceId?: Id<"helpCenterImportSources">;
          updatedAt?: number;
        } = {};

        if (existingCollection.name !== targetName) {
          updates.name = targetName;
          if (!dryRun) {
            updates.slug = await ensureUniqueSlug(
              ctx.db,
              "collections",
              args.workspaceId,
              generateSlug(targetName),
              existingCollection._id
            );
          }
        }

        if (existingCollection.parentId !== expectedParentId) {
          updates.parentId = expectedParentId;
        }

        if (existingCollection.importPath !== collectionPath) {
          updates.importPath = collectionPath;
        }

        if (sourceId && existingCollection.importSourceId !== sourceId) {
          updates.importSourceId = sourceId;
        }

        if (Object.keys(updates).length > 0) {
          if (!dryRun) {
            updates.updatedAt = now;
            await ctx.db.patch(existingCollection._id, updates);
          }
          updatedCollections += 1;
          pushPreviewPath(updatedCollectionPaths, collectionPath);
        }

        matchedCollectionIds.add(existingCollection._id);
        collectionPathToId.set(collectionPath, existingCollection._id);
        continue;
      }

      if (dryRun) {
        const simulatedCollectionId = `dry-run:${collectionPath}` as unknown as Id<"collections">;
        collectionPathToId.set(collectionPath, simulatedCollectionId);
      } else {
        if (!sourceId) {
          throw new Error("Failed to resolve import source");
        }
        const slug = await ensureUniqueSlug(
          ctx.db,
          "collections",
          args.workspaceId,
          generateSlug(targetName)
        );
        const order = await getNextCollectionOrder(ctx, args.workspaceId, expectedParentId);

        const collectionId = await ctx.db.insert("collections", {
          workspaceId: args.workspaceId,
          name: targetName,
          slug,
          parentId: expectedParentId,
          order,
          importSourceId: sourceId,
          importPath: collectionPath,
          createdAt: now,
          updatedAt: now,
        });

        collectionPathToId.set(collectionPath, collectionId);
        matchedCollectionIds.add(collectionId);
      }
      createdCollections += 1;
      pushPreviewPath(createdCollectionPaths, collectionPath);
    }

    const sortedIncomingFiles = Array.from(incomingFiles.values()).sort((a, b) =>
      a.relativePath.localeCompare(b.relativePath)
    );
    const importRunId = `${now}-${Math.random().toString(36).slice(2, 8)}`;

    for (const file of sortedIncomingFiles) {
      let existingArticle =
        existingArticleByPath.get(file.relativePath) ??
        existingArticleByStrippedPath.get(file.relativePath);
      const collectionPath = resolveIncomingCollectionPath(file);
      const collectionId = collectionPath
        ? collectionPathToId.get(collectionPath)
        : args.rootCollectionId;
      if (collectionPath && !collectionId) {
        throw new Error(`Unable to resolve collection for file "${file.relativePath}"`);
      }

      const title = file.frontmatterTitle ?? inferTitle(file.relativePath, file.content);
      const preferredSlug = file.frontmatterSlug ?? generateSlug(title);
      if (!existingArticle) {
        const titleMatchKey = buildArticleTitleMatchKey(collectionId, title);
        const titleMatches =
          articleCandidatesByTitle
            .get(titleMatchKey)
            ?.filter((candidate) => !matchedArticleIds.has(candidate._id)) ?? [];

        if (titleMatches.length === 1) {
          existingArticle = titleMatches[0];
        } else if (titleMatches.length === 0) {
          const potentialSlugs = new Set<string>([
            generateSlug(title),
            generateSlug(humanizeName(withoutMarkdownExtension(getFileName(file.relativePath)))),
            generateSlug(withoutMarkdownExtension(getFileName(file.relativePath))),
          ]);
          if (file.frontmatterSlug) {
            potentialSlugs.add(file.frontmatterSlug);
          }

          const slugMatches = new Map<Id<"articles">, (typeof workspaceArticles)[number]>();
          for (const slug of potentialSlugs) {
            const slugMatchKey = buildArticleSlugMatchKey(collectionId, slug);
            const slugCandidates =
              articleCandidatesBySlug
                .get(slugMatchKey)
                ?.filter((candidate) => !matchedArticleIds.has(candidate._id)) ?? [];
            for (const candidate of slugCandidates) {
              slugMatches.set(candidate._id, candidate);
            }
          }

          if (slugMatches.size === 1) {
            existingArticle = Array.from(slugMatches.values())[0];
          }
        }
      }

      if (existingArticle) {
        const updates: {
          title?: string;
          slug?: string;
          content?: string;
          collectionId?: Id<"collections">;
          status?: "draft" | "published";
          publishedAt?: number;
          importPath?: string;
          importSourceId?: Id<"helpCenterImportSources">;
          updatedAt?: number;
        } = {};

        if (existingArticle.title !== title) {
          updates.title = title;
          if (!dryRun) {
            updates.slug = await ensureUniqueSlug(
              ctx.db,
              "articles",
              args.workspaceId,
              preferredSlug,
              existingArticle._id
            );
          }
        }

        if (existingArticle.content !== file.content) {
          updates.content = file.content;
        }

        const targetCollectionPath = collectionPath ?? rootCollectionPathSentinel;
        const existingArticleCollectionPath = getExistingArticleCollectionPath(existingArticle);
        if (existingArticleCollectionPath !== targetCollectionPath) {
          updates.collectionId = collectionId;
        }

        if (publishByDefault && existingArticle.status !== "published") {
          updates.status = "published";
          updates.publishedAt = now;
        }

        if (existingArticle.importPath !== file.relativePath) {
          updates.importPath = file.relativePath;
        }

        if (sourceId && existingArticle.importSourceId !== sourceId) {
          updates.importSourceId = sourceId;
        }

        if (Object.keys(updates).length > 0) {
          if (!dryRun) {
            updates.updatedAt = now;
            await ctx.db.patch(existingArticle._id, updates);
          }
          updatedArticles += 1;
          pushPreviewPath(updatedArticlePaths, file.relativePath);
        }
        matchedArticleIds.add(existingArticle._id);
        continue;
      }

      if (!dryRun) {
        if (!sourceId) {
          throw new Error("Failed to resolve import source");
        }
        const order = await getNextArticleOrder(ctx, collectionId);
        const slug = await ensureUniqueSlug(
          ctx.db,
          "articles",
          args.workspaceId,
          preferredSlug
        );
        const articleId = await ctx.db.insert("articles", {
          workspaceId: args.workspaceId,
          collectionId,
          title,
          slug,
          content: file.content,
          status: publishByDefault ? "published" : "draft",
          order,
          importSourceId: sourceId,
          importPath: file.relativePath,
          createdAt: now,
          updatedAt: now,
          publishedAt: publishByDefault ? now : undefined,
        });
        matchedArticleIds.add(articleId);
      }
      createdArticles += 1;
      pushPreviewPath(createdArticlePaths, file.relativePath);
    }

    for (const article of existingArticles) {
      if (matchedArticleIds.has(article._id)) {
        continue;
      }
      if (!article.importPath) {
        continue;
      }

      if (!dryRun) {
        if (!sourceId) {
          throw new Error("Failed to resolve import source");
        }
        await ctx.db.insert("helpCenterImportArchives", {
          workspaceId: args.workspaceId,
          sourceId,
          importRunId,
          entityType: "article",
          importPath: article.importPath,
          parentPath: getDirectoryPath(article.importPath),
          name: article.title,
          content: article.content,
          status: article.status,
          deletedAt: now,
        });
        await ctx.db.delete(article._id);
      }
      deletedArticles += 1;
      deletedArticleIdsInRun.add(article._id);
      pushPreviewPath(deletedArticlePaths, article.importPath);
    }

    const collectionsToDelete = existingCollections
      .filter((collection) => collection.importPath && !matchedCollectionIds.has(collection._id))
      .sort((a, b) => pathDepth(b.importPath!) - pathDepth(a.importPath!));

    for (const collection of collectionsToDelete) {
      const childCollections = await ctx.db
        .query("collections")
        .withIndex("by_parent", (q) =>
          q.eq("workspaceId", args.workspaceId).eq("parentId", collection._id)
        )
        .collect();
      const effectiveChildCollections = childCollections.filter(
        (child) => !deletedCollectionIdsInRun.has(child._id)
      );
      const childArticles = await ctx.db
        .query("articles")
        .withIndex("by_collection", (q) => q.eq("collectionId", collection._id))
        .collect();
      const effectiveChildArticles = childArticles.filter(
        (child) => !deletedArticleIdsInRun.has(child._id)
      );

      if (effectiveChildCollections.length > 0 || effectiveChildArticles.length > 0) {
        continue;
      }

      if (!dryRun) {
        if (!sourceId) {
          throw new Error("Failed to resolve import source");
        }
        await ctx.db.insert("helpCenterImportArchives", {
          workspaceId: args.workspaceId,
          sourceId,
          importRunId,
          entityType: "collection",
          importPath: collection.importPath!,
          parentPath: getParentPath(collection.importPath!),
          name: collection.name,
          description: collection.description,
          icon: collection.icon,
          deletedAt: now,
        });
        await ctx.db.delete(collection._id);
      }
      deletedCollections += 1;
      deletedCollectionIdsInRun.add(collection._id);
      pushPreviewPath(deletedCollectionPaths, collection.importPath!);
    }

    if (!dryRun) {
      if (!sourceId) {
        throw new Error("Failed to resolve import source");
      }
      await ctx.db.patch(sourceId, {
        sourceName: args.sourceName,
        rootCollectionId: args.rootCollectionId,
        updatedAt: now,
        lastImportedAt: now,
        lastImportRunId: importRunId,
        lastImportedFileCount: incomingFiles.size + incomingAssets.size,
        lastImportedCollectionCount: desiredCollectionPaths.size,
      });
    }

    const sortPaths = (paths: string[]) => paths.slice().sort((a, b) => a.localeCompare(b));

    return {
      sourceId,
      sourceKey,
      sourceLabel: formatSourceLabel(args.sourceName, args.rootCollectionId),
      importRunId,
      dryRun,
      createdCollections,
      updatedCollections,
      createdArticles,
      updatedArticles,
      deletedArticles,
      deletedCollections,
      totalFiles: incomingFiles.size,
      totalAssets: incomingAssets.size,
      totalCollections: desiredCollectionPaths.size,
      strippedRootFolder: commonRootFolder ?? undefined,
      unresolvedImageReferences: Array.from(unresolvedImageReferenceSet).sort((a, b) =>
        a.localeCompare(b)
      ),
      preview: {
        collections: {
          create: sortPaths(createdCollectionPaths),
          update: sortPaths(updatedCollectionPaths),
          delete: sortPaths(deletedCollectionPaths),
        },
        articles: {
          create: sortPaths(createdArticlePaths),
          update: sortPaths(updatedArticlePaths),
          delete: sortPaths(deletedArticlePaths),
        },
      },
    };
  },
});

export const listSources = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    const sources = await ctx.db
      .query("helpCenterImportSources")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const rootCollectionIds = Array.from(
      new Set(
        sources
          .map((source) => source.rootCollectionId)
          .filter((collectionId): collectionId is Id<"collections"> => Boolean(collectionId))
      )
    );

    const rootCollections = new Map<Id<"collections">, string>();
    for (const collectionId of rootCollectionIds) {
      const collection = await ctx.db.get(collectionId);
      if (collection) {
        rootCollections.set(collectionId, collection.name);
      }
    }

    return sources
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((source) => ({
        ...source,
        rootCollectionName: source.rootCollectionId
          ? rootCollections.get(source.rootCollectionId)
          : undefined,
      }));
  },
});

export const listHistory = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.optional(v.id("helpCenterImportSources")),
    limit: v.optional(v.number()),
  },
  permission: "articles.read",
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 25, 100));
    const sourceId = args.sourceId;
    const archives = sourceId
      ? await ctx.db
          .query("helpCenterImportArchives")
          .withIndex("by_workspace_source", (q) =>
            q.eq("workspaceId", args.workspaceId).eq("sourceId", sourceId)
          )
          .collect()
      : await ctx.db
          .query("helpCenterImportArchives")
          .withIndex("by_workspace_deleted_at", (q) => q.eq("workspaceId", args.workspaceId))
          .collect();

    const sourceMap = new Map<string, string>();
    const sourceIds = Array.from(new Set(archives.map((entry) => entry.sourceId)));
    for (const sourceId of sourceIds) {
      const source = await ctx.db.get(sourceId);
      if (source) {
        sourceMap.set(sourceId, source.sourceName);
      }
    }

    const groups = new Map<
      string,
      {
        sourceId: Id<"helpCenterImportSources">;
        sourceName: string;
        importRunId: string;
        deletedAt: number;
        deletedArticles: number;
        deletedCollections: number;
        restoredEntries: number;
        totalEntries: number;
      }
    >();

    for (const entry of archives) {
      const groupKey = `${entry.sourceId}:${entry.importRunId}`;
      const existing = groups.get(groupKey);
      if (!existing) {
        groups.set(groupKey, {
          sourceId: entry.sourceId,
          sourceName: sourceMap.get(entry.sourceId) ?? "Unknown source",
          importRunId: entry.importRunId,
          deletedAt: entry.deletedAt,
          deletedArticles: entry.entityType === "article" ? 1 : 0,
          deletedCollections: entry.entityType === "collection" ? 1 : 0,
          restoredEntries: entry.restoredAt ? 1 : 0,
          totalEntries: 1,
        });
        continue;
      }

      existing.deletedAt = Math.max(existing.deletedAt, entry.deletedAt);
      if (entry.entityType === "article") {
        existing.deletedArticles += 1;
      } else {
        existing.deletedCollections += 1;
      }
      if (entry.restoredAt) {
        existing.restoredEntries += 1;
      }
      existing.totalEntries += 1;
    }

    return Array.from(groups.values())
      .sort((a, b) => b.deletedAt - a.deletedAt)
      .slice(0, limit)
      .map((group) => ({
        ...group,
        restorableEntries: group.totalEntries - group.restoredEntries,
      }));
  },
});

export const exportMarkdown = authQuery({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.optional(v.id("helpCenterImportSources")),
    rootCollectionId: v.optional(v.id("collections")),
    includeDrafts: v.optional(v.boolean()),
  },
  permission: "data.export",
  handler: async (ctx, args) => {
    const includeDrafts = args.includeDrafts ?? true;
    const sourceId = args.sourceId;
    const rootCollectionId = args.rootCollectionId;
    const now = Date.now();

    let sourceName: string | undefined;
    if (sourceId) {
      const source = await ctx.db.get(sourceId);
      if (!source || source.workspaceId !== args.workspaceId) {
        throw new Error("Import source not found");
      }
      sourceName = source.sourceName;
    }

    const allCollections = await ctx.db
      .query("collections")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    const collectionById = new Map(
      allCollections.map((collection) => [collection._id, collection] as const)
    );
    const childrenByParent = new Map<string, Array<Id<"collections">>>();
    for (const collection of allCollections) {
      const parentKey = collection.parentId ?? "__root__";
      const existingChildren = childrenByParent.get(parentKey) ?? [];
      existingChildren.push(collection._id);
      childrenByParent.set(parentKey, existingChildren);
    }

    const descendantSet = new Set<Id<"collections">>();
    if (rootCollectionId) {
      const rootCollection = collectionById.get(rootCollectionId);
      if (!rootCollection) {
        throw new Error("Export root collection not found");
      }
      const stack: Array<Id<"collections">> = [rootCollectionId];
      while (stack.length > 0) {
        const current = stack.pop()!;
        if (descendantSet.has(current)) {
          continue;
        }
        descendantSet.add(current);
        const children = childrenByParent.get(current) ?? [];
        for (const child of children) {
          stack.push(child);
        }
      }
    }

    const cachedPathById = new Map<Id<"collections">, string>();
    const buildCollectionPath = (collectionId: Id<"collections">): string => {
      const cached = cachedPathById.get(collectionId);
      if (cached) {
        return cached;
      }
      const collection = collectionById.get(collectionId);
      if (!collection) {
        return "";
      }
      const segment = sanitizePathSegment(collection.name) || "collection";
      const parentPath = collection.parentId ? buildCollectionPath(collection.parentId) : "";
      const fullPath = parentPath ? `${parentPath}/${segment}` : segment;
      cachedPathById.set(collectionId, fullPath);
      return fullPath;
    };

    let articles = await ctx.db
      .query("articles")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
      .collect();

    if (!includeDrafts) {
      articles = articles.filter((article) => article.status === "published");
    }
    if (sourceId) {
      articles = articles.filter((article) => article.importSourceId === sourceId);
    }
    if (rootCollectionId) {
      articles = articles.filter(
        (article) => article.collectionId && descendantSet.has(article.collectionId)
      );
    }

    const usedPaths = new Set<string>();
    const articleExports = articles
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((article) => {
        const hasCollection = Boolean(article.collectionId);
        const collectionPath = hasCollection ? buildCollectionPath(article.collectionId!) : "";
        const frontmatterCollectionPath = hasCollection
          ? collectionPath || undefined
          : UNCATEGORIZED_COLLECTION_PATH;
        const fallbackPathBase = collectionPath
          ? `${collectionPath}/${sanitizePathSegment(article.slug || article.title) || "article"}`
          : sanitizePathSegment(article.slug || article.title) || "article";
        const preferredPath =
          sourceId && article.importPath ? article.importPath : fallbackPathBase;
        const markdownPath = dedupeRelativePath(preferredPath, usedPaths);
        return {
          article,
          markdownPath,
          frontmatterCollectionPath,
        };
      });

    const referencedAssetIds = new Set<string>();
    for (const articleExport of articleExports) {
      const ids = extractAssetReferenceIds(articleExport.article.content);
      for (const id of ids) {
        referencedAssetIds.add(id);
      }
    }

    const assetPathById = new Map<string, string>();
    const assetFiles: Array<{ path: string; assetUrl: string; type: "asset" }> = [];
    for (const assetId of referencedAssetIds) {
      const asset = await ctx.db.get(assetId as Id<"articleAssets">);
      if (!asset || asset.workspaceId !== args.workspaceId) {
        continue;
      }

      const fileNameStem =
        sanitizePathSegment(withoutMarkdownExtension(asset.fileName)) || `image-${asset._id}`;
      const extension = getFileExtension(asset.fileName) || ".bin";
      const preferredAssetPath = asset.importPath
        ? `_assets/${asset.importPath}`
        : `_assets/${fileNameStem}${extension}`;
      const dedupedAssetPath = dedupePath(preferredAssetPath, usedPaths);
      const assetUrl = await ctx.storage.getUrl(asset.storageId);
      if (!assetUrl) {
        continue;
      }

      assetPathById.set(assetId, dedupedAssetPath);
      assetFiles.push({
        path: dedupedAssetPath,
        assetUrl,
        type: "asset",
      });
    }

    const markdownFiles = articleExports.map((articleExport) => {
      const bodyWithPortableAssetRefs = rewriteAssetReferencesForExport(
        articleExport.article.content,
        articleExport.markdownPath,
        assetPathById
      );
      return {
        path: articleExport.markdownPath,
        type: "markdown" as const,
        content: buildFrontmatterContent({
          title: articleExport.article.title,
          slug: articleExport.article.slug,
          status: articleExport.article.status,
          updatedAt: articleExport.article.updatedAt,
          collectionPath: articleExport.frontmatterCollectionPath,
          sourceName,
          body: bodyWithPortableAssetRefs,
        }),
      };
    });

    const files = [...markdownFiles, ...assetFiles];

    const exportNameParts = ["help-center", "markdown"];
    if (sourceName) {
      exportNameParts.push(sanitizePathSegment(sourceName) || "source");
    } else if (rootCollectionId) {
      const rootCollection = collectionById.get(rootCollectionId);
      if (rootCollection) {
        exportNameParts.push(sanitizePathSegment(rootCollection.name) || "collection");
      }
    } else {
      exportNameParts.push("all");
    }
    exportNameParts.push(new Date(now).toISOString().slice(0, 10));

    return {
      exportedAt: now,
      count: files.length,
      fileName: `${exportNameParts.join("-")}.zip`,
      files,
    };
  },
});

export const restoreRun = authMutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.id("helpCenterImportSources"),
    importRunId: v.string(),
  },
  permission: "articles.create",
  handler: async (ctx, args) => {
    const source = await ctx.db.get(args.sourceId);
    if (!source || source.workspaceId !== args.workspaceId) {
      throw new Error("Import source not found");
    }

    const allEntries = await ctx.db
      .query("helpCenterImportArchives")
      .withIndex("by_workspace_source_run", (q) =>
        q
          .eq("workspaceId", args.workspaceId)
          .eq("sourceId", args.sourceId)
          .eq("importRunId", args.importRunId)
      )
      .collect();

    const entries = allEntries.filter((entry) => !entry.restoredAt);
    if (entries.length === 0) {
      return {
        restoredCollections: 0,
        restoredArticles: 0,
      };
    }

    const now = Date.now();
    const existingCollections = await ctx.db
      .query("collections")
      .withIndex("by_workspace_import_source", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("importSourceId", args.sourceId)
      )
      .collect();
    const existingArticles = await ctx.db
      .query("articles")
      .withIndex("by_workspace_import_source", (q) =>
        q.eq("workspaceId", args.workspaceId).eq("importSourceId", args.sourceId)
      )
      .collect();

    const collectionPathToId = new Map<string, Id<"collections">>();
    for (const collection of existingCollections) {
      if (collection.importPath) {
        collectionPathToId.set(collection.importPath, collection._id);
      }
    }

    const articlePathToDoc = new Map(
      existingArticles
        .filter((article) => article.importPath)
        .map((article) => [article.importPath!, article] as const)
    );

    const collectionEntries = entries
      .filter((entry) => entry.entityType === "collection")
      .sort((a, b) => pathDepth(a.importPath) - pathDepth(b.importPath));
    const collectionArchiveByPath = new Map(
      collectionEntries.map((entry) => [entry.importPath, entry] as const)
    );

    const ensureCollectionPath = async (collectionPath: string): Promise<Id<"collections">> => {
      const existingId = collectionPathToId.get(collectionPath);
      if (existingId) {
        return existingId;
      }

      const archiveEntry = collectionArchiveByPath.get(collectionPath);
      const parentPath = archiveEntry?.parentPath ?? getParentPath(collectionPath);
      const parentId = parentPath
        ? await ensureCollectionPath(parentPath)
        : source.rootCollectionId;
      const collectionName =
        archiveEntry?.name ?? humanizeName(collectionPath.split("/").pop() ?? "");
      const slug = await ensureUniqueSlug(
        ctx.db,
        "collections",
        args.workspaceId,
        generateSlug(collectionName)
      );
      const order = await getNextCollectionOrder(ctx, args.workspaceId, parentId);

      const collectionId = await ctx.db.insert("collections", {
        workspaceId: args.workspaceId,
        name: collectionName,
        slug,
        description: archiveEntry?.description,
        icon: archiveEntry?.icon,
        parentId,
        order,
        importSourceId: args.sourceId,
        importPath: collectionPath,
        createdAt: now,
        updatedAt: now,
      });
      collectionPathToId.set(collectionPath, collectionId);
      return collectionId;
    };

    let restoredCollections = 0;
    for (const entry of collectionEntries) {
      if (collectionPathToId.has(entry.importPath)) {
        continue;
      }
      await ensureCollectionPath(entry.importPath);
      restoredCollections += 1;
    }

    let restoredArticles = 0;
    const articleEntries = entries
      .filter((entry) => entry.entityType === "article")
      .sort((a, b) => a.importPath.localeCompare(b.importPath));
    for (const entry of articleEntries) {
      const collectionPath = entry.parentPath ?? getDirectoryPath(entry.importPath);
      const collectionId = collectionPath
        ? await ensureCollectionPath(collectionPath)
        : source.rootCollectionId;
      const existingArticle = articlePathToDoc.get(entry.importPath);

      if (existingArticle) {
        const updates: {
          title?: string;
          slug?: string;
          content?: string;
          status?: "draft" | "published";
          collectionId?: Id<"collections">;
          publishedAt?: number;
          updatedAt?: number;
        } = {};

        if (existingArticle.title !== entry.name) {
          updates.title = entry.name;
          updates.slug = await ensureUniqueSlug(
            ctx.db,
            "articles",
            args.workspaceId,
            generateSlug(entry.name),
            existingArticle._id
          );
        }
        if (entry.content !== undefined && existingArticle.content !== entry.content) {
          updates.content = entry.content;
        }
        if (existingArticle.collectionId !== collectionId) {
          updates.collectionId = collectionId;
        }
        if (entry.status && existingArticle.status !== entry.status) {
          updates.status = entry.status;
          if (entry.status === "published") {
            updates.publishedAt = now;
          }
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = now;
          await ctx.db.patch(existingArticle._id, updates);
          restoredArticles += 1;
        }
        continue;
      }

      const slug = await ensureUniqueSlug(
        ctx.db,
        "articles",
        args.workspaceId,
        generateSlug(entry.name)
      );
      const order = await getNextArticleOrder(ctx, collectionId);
      await ctx.db.insert("articles", {
        workspaceId: args.workspaceId,
        collectionId,
        title: entry.name,
        slug,
        content: entry.content ?? "",
        status: entry.status ?? "published",
        order,
        importSourceId: args.sourceId,
        importPath: entry.importPath,
        createdAt: now,
        updatedAt: now,
        publishedAt: (entry.status ?? "published") === "published" ? now : undefined,
      });
      restoredArticles += 1;
    }

    for (const entry of entries) {
      await ctx.db.patch(entry._id, {
        restoredAt: now,
      });
    }

    await ctx.db.patch(args.sourceId, {
      updatedAt: now,
    });

    return {
      restoredCollections,
      restoredArticles,
    };
  },
});
