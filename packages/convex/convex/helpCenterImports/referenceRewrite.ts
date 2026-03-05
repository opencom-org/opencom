import { ASSET_REFERENCE_PREFIX, getDirectoryPath, getRelativePath } from "./pathUtils";

const ASSET_REFERENCE_REGEX = /oc-asset:\/\/([A-Za-z0-9_-]+)/g;
const MARKDOWN_IMAGE_REGEX = /!\[([^\]]*)\]\(([^)]+)\)/g;
const HTML_IMAGE_REGEX = /<img\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi;

export function extractAssetReferenceIds(markdown: string): string[] {
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

export function rewriteMarkdownImageReferences(
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

export function rewriteAssetReferencesForExport(
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
