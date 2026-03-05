import {
  UNCATEGORIZED_COLLECTION_PATH,
  getDirectoryPath,
  getFileName,
  humanizeName,
  normalizePath,
  normalizeSourceKey,
  withoutMarkdownExtension,
} from "./pathUtils";

const UNCATEGORIZED_COLLECTION_ALIASES = new Set([
  UNCATEGORIZED_COLLECTION_PATH,
  "uncategorised",
]);

export function inferTitle(filePath: string, content: string): string {
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

export function parseMarkdownImportContent(content: string): {
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

export function resolveIncomingCollectionPath(file: {
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
