"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import {
  Plus,
  Search,
  FileText,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  History,
  Download,
} from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";
import { strToU8, zipSync } from "fflate";

type ImportSelectionItem = {
  file: File;
  relativePath: string;
};

type ImportAssetPayload = {
  relativePath: string;
  storageId: Id<"_storage">;
  mimeType?: string;
  size?: number;
};

type MarkdownImportPreview = {
  dryRun: boolean;
  createdCollections: number;
  updatedCollections: number;
  createdArticles: number;
  updatedArticles: number;
  deletedArticles: number;
  deletedCollections: number;
  totalFiles: number;
  totalAssets?: number;
  strippedRootFolder?: string;
  unresolvedImageReferences?: string[];
  preview: {
    collections: {
      create: string[];
      update: string[];
      delete: string[];
    };
    articles: {
      create: string[];
      update: string[];
      delete: string[];
    };
  };
};

type DeleteArticleTarget = {
  id: Id<"articles">;
  title: string;
};

const ALL_COLLECTION_FILTER = "all";
const GENERAL_COLLECTION_FILTER = "general";

type CollectionFilter =
  | typeof ALL_COLLECTION_FILTER
  | typeof GENERAL_COLLECTION_FILTER
  | Id<"collections">;
type CollectionFilterItem = {
  id: CollectionFilter;
  label: string;
  count: number;
};

function ArticlesContent() {
  const router = useRouter();
  const { activeWorkspace } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>(
    ALL_COLLECTION_FILTER
  );
  const [importSourceName, setImportSourceName] = useState("");
  const [importTargetCollectionId, setImportTargetCollectionId] = useState<
    Id<"collections"> | undefined
  >(undefined);
  const [selectedImportItems, setSelectedImportItems] = useState<ImportSelectionItem[]>([]);
  const [selectedImportAssetItems, setSelectedImportAssetItems] = useState<ImportSelectionItem[]>(
    []
  );
  const [importPreview, setImportPreview] = useState<MarkdownImportPreview | null>(null);
  const [previewSignature, setPreviewSignature] = useState<string | null>(null);
  const [isPreviewingImport, setIsPreviewingImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSourceId, setExportSourceId] = useState<Id<"helpCenterImportSources"> | undefined>(
    undefined
  );
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [restoringRunId, setRestoringRunId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteArticleTarget | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeletingArticle, setIsDeletingArticle] = useState(false);
  const folderInputRef = useRef<HTMLInputElement | null>(null);

  const articles = useQuery(
    api.articles.list,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const collections = useQuery(
    api.collections.listHierarchy,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const importSources = useQuery(
    api.helpCenterImports.listSources,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const importHistory = useQuery(
    api.helpCenterImports.listHistory,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id, limit: 10 } : "skip"
  );
  const markdownExport = useQuery(
    api.helpCenterImports.exportMarkdown,
    isExporting && activeWorkspace?._id
      ? {
          workspaceId: activeWorkspace._id,
          sourceId: exportSourceId,
          includeDrafts: true,
        }
      : "skip"
  );

  const createArticle = useMutation(api.articles.create);
  const deleteArticle = useMutation(api.articles.remove);
  const publishArticle = useMutation(api.articles.publish);
  const unpublishArticle = useMutation(api.articles.unpublish);
  const syncMarkdownFolder = useMutation(api.helpCenterImports.syncMarkdownFolder);
  const restoreImportRun = useMutation(api.helpCenterImports.restoreRun);
  const generateAssetUploadUrl = useMutation(api.articles.generateAssetUploadUrl);
  const logExport = useMutation(api.auditLogs.logExport);

  const handleCreateArticle = async () => {
    if (!activeWorkspace?._id) return;
    const articleId = await createArticle({
      workspaceId: activeWorkspace._id,
      title: "Untitled Article",
      content: "",
    });
    router.push(`/articles/${articleId}`);
  };

  const handleDeleteRequest = (id: Id<"articles">, title: string) => {
    setDeleteError(null);
    setDeleteTarget({ id, title });
  };

  const handleDeleteCancel = () => {
    if (isDeletingArticle) {
      return;
    }
    setDeleteError(null);
    setDeleteTarget(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) {
      return;
    }

    setIsDeletingArticle(true);
    setDeleteError(null);
    try {
      await deleteArticle({ id: deleteTarget.id });
      setDeleteTarget(null);
    } catch (error) {
      console.error("Failed to delete article:", error);
      setDeleteError(error instanceof Error ? error.message : "Failed to delete article.");
    } finally {
      setIsDeletingArticle(false);
    }
  };

  const handleTogglePublish = async (id: Id<"articles">, isPublished: boolean) => {
    if (isPublished) {
      await unpublishArticle({ id });
    } else {
      await publishArticle({ id });
    }
  };

  const getRawImportRelativePath = (file: File): string => {
    const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath;
    const fallback = relativePath && relativePath.length > 0 ? relativePath : file.name;
    return fallback
      .replace(/\\/g, "/")
      .trim()
      .replace(/^\/+|\/+$/g, "");
  };

  const deriveDefaultSourceName = (paths: string[]): string => {
    if (paths.length === 0) {
      return "docs";
    }
    const firstSegment = paths[0]?.split("/")[0] ?? "docs";
    return firstSegment.replace(/\.(md|markdown)$/i, "") || "docs";
  };

  const buildImportSignature = (
    sourceName: string,
    targetCollectionId: Id<"collections"> | undefined,
    markdownItems: ImportSelectionItem[],
    assetItems: ImportSelectionItem[]
  ): string => {
    const normalizedSourceName = sourceName.trim().toLowerCase();
    const normalizedTarget = targetCollectionId ?? "root";
    const normalizedMarkdownItems = markdownItems
      .map((item) => `${item.relativePath}:${item.file.size}:${item.file.lastModified}`)
      .sort((a, b) => a.localeCompare(b));
    const normalizedAssetItems = assetItems
      .map((item) => `${item.relativePath}:${item.file.size}:${item.file.lastModified}`)
      .sort((a, b) => a.localeCompare(b));
    return [normalizedSourceName, normalizedTarget, ...normalizedMarkdownItems, ...normalizedAssetItems].join(
      "::"
    );
  };

  const currentImportSignature = buildImportSignature(
    importSourceName,
    importTargetCollectionId,
    selectedImportItems,
    selectedImportAssetItems
  );

  const buildImportPayload = async () =>
    Promise.all(
      selectedImportItems.map(async (item) => ({
        relativePath: item.relativePath,
        content: await item.file.text(),
      }))
    );

  const buildImportAssetPreviewPayload = () =>
    selectedImportAssetItems.map((item) => ({
      relativePath: item.relativePath,
      mimeType: item.file.type || undefined,
      size: item.file.size,
    }));

  const uploadImportAssets = async (): Promise<ImportAssetPayload[]> => {
    if (!activeWorkspace?._id || selectedImportAssetItems.length === 0) {
      return [];
    }

    const uploadedAssets: ImportAssetPayload[] = [];
    for (const item of selectedImportAssetItems) {
      const uploadUrl = await generateAssetUploadUrl({ workspaceId: activeWorkspace._id });
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": item.file.type || "application/octet-stream",
        },
        body: item.file,
      });
      if (!response.ok) {
        throw new Error(`Failed to upload image "${item.relativePath}"`);
      }

      const payload = (await response.json()) as { storageId?: Id<"_storage"> };
      if (!payload.storageId) {
        throw new Error(`Missing storageId for uploaded image "${item.relativePath}"`);
      }
      uploadedAssets.push({
        relativePath: item.relativePath,
        storageId: payload.storageId,
        mimeType: item.file.type || undefined,
        size: item.file.size,
      });
    }

    return uploadedAssets;
  };

  const handleImportFolderSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const markdownFiles = files.filter((file) => /\.(md|markdown)$/i.test(file.name));
    const imageFiles = files.filter((file) => /\.(png|jpe?g|gif|webp|avif)$/i.test(file.name));

    if (markdownFiles.length === 0) {
      setSelectedImportItems([]);
      setSelectedImportAssetItems([]);
      setImportPreview(null);
      setPreviewSignature(null);
      setImportError("No markdown files found in selection.");
      setImportNotice(null);
      return;
    }

    const rawPaths = markdownFiles.map(getRawImportRelativePath);

    const items = markdownFiles.map((file, index) => ({
      file,
      relativePath: rawPaths[index]!,
    }));
    const assetItems = imageFiles.map((file) => ({
      file,
      relativePath: getRawImportRelativePath(file),
    }));
    setSelectedImportItems(items);
    setSelectedImportAssetItems(assetItems);
    setImportPreview(null);
    setPreviewSignature(null);
    setImportError(null);
    setImportNotice(null);
    if (!importSourceName.trim()) {
      setImportSourceName(deriveDefaultSourceName(rawPaths));
    }
  };

  const handleImportSourceNameChange = (value: string) => {
    setImportSourceName(value);
    setImportPreview(null);
    setPreviewSignature(null);
  };

  const handleImportTargetCollectionChange = (value: string) => {
    setImportTargetCollectionId(value ? (value as Id<"collections">) : undefined);
    setImportPreview(null);
    setPreviewSignature(null);
  };

  const handlePreviewImport = async () => {
    if (!activeWorkspace?._id || selectedImportItems.length === 0) {
      return;
    }

    const sourceName = importSourceName.trim();
    if (!sourceName) {
      setImportError("Import source name is required.");
      setImportNotice(null);
      return;
    }

    const signatureAtPreview = currentImportSignature;
    setIsPreviewingImport(true);
    setImportError(null);
    setImportNotice(null);

    try {
      const files = await buildImportPayload();
      const assets = buildImportAssetPreviewPayload();

      const result = await syncMarkdownFolder({
        workspaceId: activeWorkspace._id,
        sourceName,
        rootCollectionId: importTargetCollectionId,
        files,
        assets,
        publishByDefault: true,
        dryRun: true,
      });

      setImportPreview(result as MarkdownImportPreview);
      setPreviewSignature(signatureAtPreview);
      const rootStripSuffix = result.strippedRootFolder
        ? ` Upload root "${result.strippedRootFolder}" will be ignored.`
        : "";
      const unresolvedSuffix =
        result.unresolvedImageReferences && result.unresolvedImageReferences.length > 0
          ? ` ${result.unresolvedImageReferences.length} unresolved image reference(s) detected.`
          : "";
      setImportNotice(
        `Preview ready. Create ${result.createdArticles} articles / ${result.createdCollections} collections, update ${result.updatedArticles} articles / ${result.updatedCollections} collections, delete ${result.deletedArticles} articles / ${result.deletedCollections} collections.${rootStripSuffix}${unresolvedSuffix}`
      );
    } catch (error) {
      console.error("Failed to preview markdown import:", error);
      setImportPreview(null);
      setPreviewSignature(null);
      setImportError(
        error instanceof Error ? error.message : "Failed to preview markdown folder sync."
      );
    } finally {
      setIsPreviewingImport(false);
    }
  };

  const handleStartImport = async () => {
    if (!activeWorkspace?._id || selectedImportItems.length === 0) {
      return;
    }

    const sourceName = importSourceName.trim();
    if (!sourceName) {
      setImportError("Import source name is required.");
      setImportNotice(null);
      return;
    }

    if (!importPreview || previewSignature !== currentImportSignature) {
      setImportError("Run Preview Changes before applying import.");
      setImportNotice(null);
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportNotice(null);

    try {
      const files = await buildImportPayload();
      const assets = await uploadImportAssets();

      const result = await syncMarkdownFolder({
        workspaceId: activeWorkspace._id,
        sourceName,
        rootCollectionId: importTargetCollectionId,
        files,
        assets,
        publishByDefault: true,
      });

      const rootStripSuffix = result.strippedRootFolder
        ? ` Ignored upload root folder "${result.strippedRootFolder}".`
        : "";
      const unresolvedSuffix =
        result.unresolvedImageReferences && result.unresolvedImageReferences.length > 0
          ? ` ${result.unresolvedImageReferences.length} unresolved image reference(s) were left unchanged.`
          : "";
      setImportNotice(
        `Synced ${result.totalFiles} markdown file(s) and ${result.totalAssets ?? 0} image file(s). Added ${result.createdArticles}, updated ${result.updatedArticles}, removed ${result.deletedArticles}.${rootStripSuffix}${unresolvedSuffix}`
      );
      setSelectedImportItems([]);
      setSelectedImportAssetItems([]);
      setImportPreview(null);
      setPreviewSignature(null);
      if (folderInputRef.current) {
        folderInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Failed to import markdown folder:", error);
      setImportError(error instanceof Error ? error.message : "Failed to sync markdown folder.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleRestoreRun = async (sourceId: Id<"helpCenterImportSources">, importRunId: string) => {
    if (!activeWorkspace?._id) {
      return;
    }
    setRestoringRunId(importRunId);
    setImportError(null);
    setImportNotice(null);
    try {
      const result = await restoreImportRun({
        workspaceId: activeWorkspace._id,
        sourceId,
        importRunId,
      });
      setImportNotice(
        `Restored ${result.restoredArticles} articles and ${result.restoredCollections} collections from history.`
      );
    } catch (error) {
      console.error("Failed to restore import history run:", error);
      setImportError(error instanceof Error ? error.message : "Failed to restore history run.");
    } finally {
      setRestoringRunId(null);
    }
  };

  const handleExportMarkdown = () => {
    if (!activeWorkspace?._id) {
      return;
    }
    setImportError(null);
    setImportNotice(null);
    setIsExporting(true);
  };

  useEffect(() => {
    if (!markdownExport || !isExporting || !activeWorkspace?._id) {
      return;
    }

    let cancelled = false;
    const buildArchive = async () => {
      try {
        const archiveFiles: Record<string, Uint8Array> = {};
        for (const file of markdownExport.files) {
          if (file.type === "asset" && file.assetUrl) {
            const response = await fetch(file.assetUrl);
            if (!response.ok) {
              throw new Error(`Failed to fetch exported asset "${file.path}"`);
            }
            const bytes = new Uint8Array(await response.arrayBuffer());
            archiveFiles[file.path] = bytes;
            continue;
          }
          archiveFiles[file.path] = strToU8(file.content ?? "");
        }

        const zipped = zipSync(archiveFiles, { level: 6 });
        const zipBytes = new Uint8Array(zipped);
        const blob = new Blob([zipBytes], { type: "application/zip" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = markdownExport.fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);

        logExport({
          workspaceId: activeWorkspace._id,
          exportType: "helpCenterMarkdown",
          recordCount: markdownExport.count,
        }).catch((error) => {
          console.error("Failed to log markdown export:", error);
        });

        if (!cancelled) {
          setImportNotice(`Exported ${markdownExport.count} file(s).`);
          setImportError(null);
        }
      } catch (error) {
        console.error("Failed to create markdown export archive:", error);
        if (!cancelled) {
          setImportError(error instanceof Error ? error.message : "Failed to export markdown.");
        }
      } finally {
        if (!cancelled) {
          setIsExporting(false);
        }
      }
    };

    void buildArchive();
    return () => {
      cancelled = true;
    };
  }, [activeWorkspace?._id, isExporting, logExport, markdownExport]);

  const getCollectionName = (collectionId?: Id<"collections">) => {
    if (!collectionId || !collections) return "General";
    const collection = collections.find(
      (c: NonNullable<typeof collections>[number]) => c._id === collectionId
    );
    return collection?.name || "General";
  };

  const getArticleCollectionFilter = (collectionId?: Id<"collections">): CollectionFilter => {
    if (!collectionId) {
      return GENERAL_COLLECTION_FILTER;
    }
    return collectionId;
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredArticles = articles?.filter((article: NonNullable<typeof articles>[number]) => {
    const matchesSearch = article.title.toLowerCase().includes(normalizedSearchQuery);
    const matchesCollection =
      collectionFilter === ALL_COLLECTION_FILTER
        ? true
        : collectionFilter === GENERAL_COLLECTION_FILTER
          ? !article.collectionId
          : article.collectionId === collectionFilter;

    return matchesSearch && matchesCollection;
  });
  const selectedImportPaths = selectedImportItems.map((item) => item.relativePath);
  const selectedImportAssetPaths = selectedImportAssetItems.map((item) => item.relativePath);
  const hasCurrentPreview = Boolean(
    importPreview && previewSignature && previewSignature === currentImportSignature
  );
  const isPreviewStale = Boolean(importPreview && previewSignature !== currentImportSignature);

  const collectionMap = new Map(
    (collections ?? []).map((collection: NonNullable<typeof collections>[number]) => [
      collection._id,
      collection,
    ])
  );
  const getCollectionLabel = (collectionId: Id<"collections">): string => {
    const seen = new Set<string>();
    const names: string[] = [];
    let cursor: Id<"collections"> | undefined = collectionId;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const collection = collectionMap.get(cursor);
      if (!collection) {
        break;
      }
      names.unshift(collection.name);
      cursor = collection.parentId;
    }
    return names.join(" / ");
  };
  const collectionArticleCounts = new Map<string, number>();
  for (const article of articles ?? []) {
    if (!article.collectionId) {
      continue;
    }
    collectionArticleCounts.set(
      article.collectionId,
      (collectionArticleCounts.get(article.collectionId) ?? 0) + 1
    );
  }

  const collectionFilterItems: CollectionFilterItem[] = [
    {
      id: ALL_COLLECTION_FILTER,
      label: "All",
      count: articles?.length ?? 0,
    },
    {
      id: GENERAL_COLLECTION_FILTER,
      label: "General",
      count: (articles ?? []).filter(
        (article: NonNullable<typeof articles>[number]) => !article.collectionId
      ).length,
    },
    ...((collections ?? []).map(
      (collection: NonNullable<typeof collections>[number]): CollectionFilterItem => ({
        id: collection._id,
        label: collection.name,
        count: collectionArticleCounts.get(collection._id) ?? 0,
      })
    ) ?? []),
  ];
  const hasArticles = (articles?.length ?? 0) > 0;
  const hasActiveFilters =
    normalizedSearchQuery.length > 0 || collectionFilter !== ALL_COLLECTION_FILTER;
  const clearAllFilters = () => {
    setSearchQuery("");
    setCollectionFilter(ALL_COLLECTION_FILTER);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatPreviewPathSample = (paths: string[]): string => {
    const sample = paths.slice(0, 4);
    if (sample.length === 0) {
      return "";
    }
    const remaining = paths.length - sample.length;
    return remaining > 0 ? `${sample.join(", ")} (+${remaining} more)` : sample.join(", ");
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Articles</h1>
          <p className="text-gray-500">Manage your help center articles</p>
        </div>
        <div className="flex gap-2">
          <Link href="/articles/collections">
            <Button variant="outline">Manage Collections</Button>
          </Link>
          <Button onClick={handleCreateArticle}>
            <Plus className="h-4 w-4 mr-2" />
            New Article
          </Button>
        </div>
      </div>

      <div className="mb-6 border rounded-lg bg-white p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold">Import Markdown Folder</h2>
            <p className="text-sm text-gray-500">
              Sync markdown files into Help Center collections. Reuploading overwrites matching
              paths, adds new files, and archives removed paths for restore. Preview changes before
              applying.
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Imports normalize folder uploads on the backend so the selected upload root folder
              does not become an extra collection level.
            </p>
          </div>
          <input
            data-testid="markdown-import-folder-input"
            ref={(node) => {
              folderInputRef.current = node;
              if (node) {
                node.setAttribute("webkitdirectory", "");
                node.setAttribute("directory", "");
              }
            }}
            type="file"
            className="hidden"
            multiple
            onChange={handleImportFolderSelection}
          />
          <Button variant="outline" onClick={() => folderInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Choose Folder
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Source Name</label>
            <Input
              value={importSourceName}
              onChange={(e) => handleImportSourceNameChange(e.target.value)}
              placeholder="docs"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Import Into Collection
            </label>
            <select
              value={importTargetCollectionId ?? ""}
              onChange={(e) => handleImportTargetCollectionChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Workspace root</option>
              {collections?.map((collection: NonNullable<typeof collections>[number]) => (
                <option key={collection._id} value={collection._id}>
                  {getCollectionLabel(collection._id)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(selectedImportPaths.length > 0 || selectedImportAssetPaths.length > 0) && (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
            <div
              data-testid="markdown-import-selection-count"
              className="text-sm text-gray-700 mb-1"
            >
              {selectedImportPaths.length} markdown file
              {selectedImportPaths.length !== 1 ? "s" : ""} and {selectedImportAssetPaths.length}{" "}
              image file{selectedImportAssetPaths.length !== 1 ? "s" : ""} selected
            </div>
            <div className="text-xs text-gray-500 space-y-1 max-h-32 overflow-auto">
              {selectedImportPaths.slice(0, 6).map((path) => (
                <div key={path} className="font-mono">
                  md: {path}
                </div>
              ))}
              {selectedImportAssetPaths.slice(0, 6).map((path) => (
                <div key={path} className="font-mono">
                  img: {path}
                </div>
              ))}
              {selectedImportPaths.length > 6 && (
                <div>+ {selectedImportPaths.length - 6} more markdown files...</div>
              )}
              {selectedImportAssetPaths.length > 6 && (
                <div>+ {selectedImportAssetPaths.length - 6} more image files...</div>
              )}
            </div>
          </div>
        )}

        {hasCurrentPreview && importPreview && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-3 space-y-2">
            <div className="text-sm font-medium text-blue-900">Import Preview</div>
            <div className="grid gap-2 text-xs text-blue-900 md:grid-cols-2">
              <div>
                Collections: +{importPreview.createdCollections} / ~
                {importPreview.updatedCollections} / -{importPreview.deletedCollections}
              </div>
              <div>
                Articles: +{importPreview.createdArticles} / ~{importPreview.updatedArticles} / -
                {importPreview.deletedArticles}
              </div>
            </div>
            {importPreview.strippedRootFolder && (
              <div className="text-xs text-blue-800">
                Upload root folder &ldquo;{importPreview.strippedRootFolder}&rdquo; will be ignored.
              </div>
            )}
            {importPreview.unresolvedImageReferences &&
              importPreview.unresolvedImageReferences.length > 0 && (
                <div className="text-xs text-amber-700 rounded border border-amber-200 bg-amber-50 p-2">
                  Unresolved image references ({importPreview.unresolvedImageReferences.length}):{" "}
                  <span className="font-mono">
                    {formatPreviewPathSample(importPreview.unresolvedImageReferences)}
                  </span>
                </div>
              )}
            <div className="grid gap-2 text-xs md:grid-cols-2">
              <div>
                <div className="font-medium text-blue-900">Article Changes</div>
                <div className="text-blue-800">
                  Create: {importPreview.preview.articles.create.length}, Update:{" "}
                  {importPreview.preview.articles.update.length}, Delete:{" "}
                  {importPreview.preview.articles.delete.length}
                </div>
              </div>
              <div>
                <div className="font-medium text-blue-900">Collection Changes</div>
                <div className="text-blue-800">
                  Create: {importPreview.preview.collections.create.length}, Update:{" "}
                  {importPreview.preview.collections.update.length}, Delete:{" "}
                  {importPreview.preview.collections.delete.length}
                </div>
              </div>
            </div>
            <div className="space-y-1 text-xs text-blue-900">
              {importPreview.preview.articles.delete.length > 0 && (
                <div>
                  Articles to delete:{" "}
                  <span className="font-mono">
                    {formatPreviewPathSample(importPreview.preview.articles.delete)}
                  </span>
                </div>
              )}
              {importPreview.preview.articles.create.length > 0 && (
                <div>
                  Articles to create:{" "}
                  <span className="font-mono">
                    {formatPreviewPathSample(importPreview.preview.articles.create)}
                  </span>
                </div>
              )}
              {importPreview.preview.collections.create.length > 0 && (
                <div>
                  Collections to create:{" "}
                  <span className="font-mono">
                    {formatPreviewPathSample(importPreview.preview.collections.create)}
                  </span>
                </div>
              )}
              {importPreview.preview.collections.delete.length > 0 && (
                <div>
                  Collections to delete:{" "}
                  <span className="font-mono">
                    {formatPreviewPathSample(importPreview.preview.collections.delete)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {isPreviewStale && (
          <div className="text-sm text-amber-700 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            Import inputs changed after preview. Run Preview Changes again before applying.
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            data-testid="markdown-import-preview-button"
            variant="outline"
            onClick={handlePreviewImport}
            disabled={isPreviewingImport || isImporting || selectedImportItems.length === 0}
          >
            {isPreviewingImport ? "Previewing..." : "Preview Changes"}
          </Button>
          <Button
            data-testid="markdown-import-sync-button"
            onClick={handleStartImport}
            disabled={
              isImporting ||
              isPreviewingImport ||
              selectedImportItems.length === 0 ||
              !hasCurrentPreview
            }
          >
            {isImporting ? "Applying..." : "Apply Import"}
          </Button>
          <select
            value={exportSourceId ?? ""}
            onChange={(e) =>
              setExportSourceId(
                e.target.value ? (e.target.value as Id<"helpCenterImportSources">) : undefined
              )
            }
            className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Export all docs</option>
            {importSources?.map((source: NonNullable<typeof importSources>[number]) => (
              <option key={source._id} value={source._id}>
                {source.sourceName}
              </option>
            ))}
          </select>
          <Button
            data-testid="markdown-export-button"
            variant="outline"
            onClick={handleExportMarkdown}
            disabled={isExporting}
          >
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? "Preparing Export..." : "Export Markdown"}
          </Button>
        </div>

        {importError && (
          <div className="text-sm text-red-600 rounded-md border border-red-200 bg-red-50 px-3 py-2">
            {importError}
          </div>
        )}
        {importNotice && (
          <div className="text-sm text-green-700 rounded-md border border-green-200 bg-green-50 px-3 py-2">
            {importNotice}
          </div>
        )}

        {(importSources?.length ?? 0) > 0 && (
          <div className="pt-2 border-t">
            <h3 className="text-sm font-semibold mb-2">Active Import Sources</h3>
            <div className="space-y-1 text-sm text-gray-600">
              {importSources?.map((source: NonNullable<typeof importSources>[number]) => (
                <div key={source._id} className="flex items-center justify-between">
                  <span>
                    {source.sourceName}
                    {source.rootCollectionName ? ` -> ${source.rootCollectionName}` : " -> root"}
                  </span>
                  <span className="text-xs text-gray-500">
                    {source.lastImportedFileCount ?? 0} files
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(importHistory?.length ?? 0) > 0 && (
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2 mb-2">
              <History className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold">Deletion History</h3>
            </div>
            <div className="space-y-2">
              {importHistory?.map((run: NonNullable<typeof importHistory>[number]) => (
                <div
                  key={`${run.sourceId}-${run.importRunId}`}
                  className="border rounded-md px-3 py-2 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-medium">{run.sourceName}</div>
                    <div className="text-xs text-gray-500">
                      Removed {run.deletedArticles} article{run.deletedArticles !== 1 ? "s" : ""}
                      {" + "}
                      {run.deletedCollections} collection
                      {run.deletedCollections !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={run.restorableEntries === 0 || restoringRunId === run.importRunId}
                    onClick={() => handleRestoreRun(run.sourceId, run.importRunId)}
                  >
                    {restoringRunId === run.importRunId ? "Restoring..." : "Restore"}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {collectionFilterItems.map((filterItem) => {
          const isActive = collectionFilter === filterItem.id;
          return (
            <button
              key={filterItem.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => setCollectionFilter(filterItem.id)}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-gray-200 bg-white text-gray-600 hover:border-primary/30 hover:text-primary"
              }`}
            >
              <span>{filterItem.label}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  isActive ? "bg-primary/20 text-primary" : "bg-gray-100 text-gray-500"
                }`}
              >
                {filterItem.count}
              </span>
            </button>
          );
        })}
      </div>

      {filteredArticles?.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {hasArticles ? "No matching articles" : "No articles yet"}
          </h3>
          <p className="text-gray-500 mb-4">
            {hasArticles
              ? "Try another search term or collection filter."
              : "Create your first article to help your customers"}
          </p>
          {hasArticles ? (
            <Button variant="outline" onClick={clearAllFilters}>
              Clear filters
            </Button>
          ) : (
            <Button onClick={handleCreateArticle}>
              <Plus className="h-4 w-4 mr-2" />
              Create Article
            </Button>
          )}
        </div>
      ) : (
        <div className="border rounded-lg bg-white overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Title</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Collection
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Updated</th>
                <th className="w-[120px] px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredArticles?.map((article: NonNullable<typeof articles>[number]) => {
                const articleCollectionFilter = getArticleCollectionFilter(article.collectionId);

                return (
                  <tr key={article._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/articles/${article._id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {article.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      <button
                        type="button"
                        onClick={() => setCollectionFilter(articleCollectionFilter)}
                        className={`transition-colors hover:text-primary hover:underline ${
                          collectionFilter === articleCollectionFilter
                            ? "text-primary underline"
                            : "text-gray-500"
                        }`}
                      >
                        {getCollectionName(article.collectionId)}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          article.status === "published"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {article.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(article.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link href={`/articles/${article._id}`}>
                          <Button variant="ghost" size="sm">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleTogglePublish(article._id, article.status === "published")
                          }
                        >
                          {article.status === "published" ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRequest(article._id, article.title)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-2">Delete Article</h2>
            <p className="text-sm text-gray-600">
              Are you sure you want to delete <strong>{deleteTarget.title}</strong>? This action
              cannot be undone.
            </p>
            {deleteError && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {deleteError}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={handleDeleteCancel} disabled={isDeletingArticle}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
                disabled={isDeletingArticle}
              >
                {isDeletingArticle ? "Deleting..." : "Delete Article"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArticlesPage() {
  return (
    <AppLayout>
      <ArticlesContent />
    </AppLayout>
  );
}
