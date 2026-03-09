"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter, useSearchParams } from "next/navigation";
import { makeFunctionReference } from "convex/server";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@opencom/ui";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";
import { strToU8, zipSync } from "fflate";
import { ArticlesImportSection } from "./ArticlesImportSection";
import { ArticlesListSection } from "./ArticlesListSection";
import { DeleteArticleDialog } from "./DeleteArticleDialog";
import {
  ALL_COLLECTION_FILTER,
  type ArticleEditorId,
  type ArticleListItem,
  type CollectionFilter,
  type CollectionListItem,
  type DeleteArticleTarget,
  type ImportAssetPayload,
  type ImportHistoryListItem,
  type ImportSelectionItem,
  type ImportSourceListItem,
  type MarkdownExportPayload,
  type MarkdownImportPreview,
} from "./articlesAdminTypes";
import {
  ALL_STATUS_FILTER,
  buildCollectionFilterItems,
  buildImportSignature,
  deriveDefaultSourceName,
  filterArticles,
  getRawImportRelativePath,
  type StatusFilter,
  type VisibilityFilter,
  ALL_VISIBILITY_FILTER,
} from "./articlesAdminUtils";

function ArticlesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeWorkspace } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [collectionFilter, setCollectionFilter] = useState<CollectionFilter>(
    ALL_COLLECTION_FILTER
  );
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>(
    ALL_VISIBILITY_FILTER
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL_STATUS_FILTER);
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
  const createQueryHandledRef = useRef(false);

  const articlesListQuery = makeFunctionReference<
    "query",
    { workspaceId: Id<"workspaces"> },
    ArticleListItem[]
  >("articles:list");
  const collectionsListHierarchyQuery = makeFunctionReference<
    "query",
    { workspaceId: Id<"workspaces"> },
    CollectionListItem[]
  >("collections:listHierarchy");
  const importSourcesQuery = makeFunctionReference<
    "query",
    { workspaceId: Id<"workspaces"> },
    ImportSourceListItem[]
  >("helpCenterImports:listSources");
  const importHistoryQuery = makeFunctionReference<
    "query",
    { workspaceId: Id<"workspaces">; limit: number },
    ImportHistoryListItem[]
  >("helpCenterImports:listHistory");
  const exportMarkdownQuery = makeFunctionReference<
    "query",
    {
      workspaceId: Id<"workspaces">;
      sourceId: Id<"helpCenterImportSources"> | undefined;
      includeDrafts: boolean;
    },
    MarkdownExportPayload
  >("helpCenterImports:exportMarkdown");
  const createArticleRef = makeFunctionReference<
    "mutation",
    {
      workspaceId: Id<"workspaces">;
      title: string;
      content: string;
      visibility: "public" | "internal";
    },
    Id<"articles">
  >("articles:create");
  const deleteArticleRef = makeFunctionReference<
    "mutation",
    { id: ArticleEditorId },
    unknown
  >("articles:remove");
  const publishArticleRef = makeFunctionReference<
    "mutation",
    { id: ArticleEditorId },
    unknown
  >("articles:publish");
  const unpublishArticleRef = makeFunctionReference<
    "mutation",
    { id: ArticleEditorId },
    unknown
  >("articles:unpublish");
  const syncMarkdownFolderRef = makeFunctionReference<
    "mutation",
    any,
    {
      strippedRootFolder?: string;
      unresolvedImageReferences?: string[];
      createdArticles: number;
      createdCollections: number;
      updatedArticles: number;
      updatedCollections: number;
      deletedArticles: number;
      deletedCollections: number;
      totalFiles?: number;
      totalAssets?: number;
      sourceId?: Id<"helpCenterImportSources">;
      importRunId?: string;
    }
  >("helpCenterImports:syncMarkdownFolder");
  const restoreImportRunRef = makeFunctionReference<
    "mutation",
    any,
    {
      restoredArticles: number;
      restoredCollections: number;
      sourceName?: string;
    }
  >("helpCenterImports:restoreRun");
  const generateAssetUploadUrlRef = makeFunctionReference<
    "mutation",
    { workspaceId: Id<"workspaces"> },
    string
  >("articles:generateAssetUploadUrl");
  const logExportRef = makeFunctionReference<"mutation", any, unknown>("auditLogs:logExport");

  const articles = useQuery(
    articlesListQuery,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  ) as ArticleListItem[] | undefined;

  const collections = useQuery(
    collectionsListHierarchyQuery,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  ) as CollectionListItem[] | undefined;
  const importSources = useQuery(
    importSourcesQuery,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  ) as ImportSourceListItem[] | undefined;
  const importHistory = useQuery(
    importHistoryQuery,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id, limit: 10 } : "skip"
  ) as ImportHistoryListItem[] | undefined;
  const markdownExport = useQuery(
    exportMarkdownQuery,
    isExporting && activeWorkspace?._id
      ? {
          workspaceId: activeWorkspace._id,
          sourceId: exportSourceId,
          includeDrafts: true,
        }
      : "skip"
  ) as MarkdownExportPayload | undefined;

  const createArticle = useMutation(createArticleRef);
  const deleteArticle = useMutation(deleteArticleRef);
  const publishArticle = useMutation(publishArticleRef);
  const unpublishArticle = useMutation(unpublishArticleRef);
  const syncMarkdownFolder = useMutation(syncMarkdownFolderRef);
  const restoreImportRun = useMutation(restoreImportRunRef);
  const generateAssetUploadUrl = useMutation(generateAssetUploadUrlRef);
  const logExport = useMutation(logExportRef);

  const handleCreateArticle = useCallback(
    async (visibility: "public" | "internal" = "public") => {
      if (!activeWorkspace?._id) {
        return;
      }
      const articleId = await createArticle({
        workspaceId: activeWorkspace._id,
        title: "Untitled Article",
        content: "",
        visibility,
      });
      router.push(`/articles/${articleId}`);
    },
    [activeWorkspace?._id, createArticle, router]
  );

  useEffect(() => {
    if (createQueryHandledRef.current) {
      return;
    }

    const createMode = searchParams.get("create");
    if (!createMode || !activeWorkspace?._id) {
      return;
    }

    createQueryHandledRef.current = true;
    void handleCreateArticle(createMode === "internal" ? "internal" : "public");
  }, [activeWorkspace?._id, handleCreateArticle, searchParams]);

  const handleDeleteRequest = (id: ArticleEditorId, title: string) => {
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

  const handleTogglePublish = async (id: ArticleEditorId, isPublished: boolean) => {
    if (isPublished) {
      await unpublishArticle({ id });
    } else {
      await publishArticle({ id });
    }
  };

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

  const currentImportSignature = buildImportSignature(
    importSourceName,
    importTargetCollectionId,
    selectedImportItems,
    selectedImportAssetItems
  );

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

  const handleExportSourceChange = (value: string) => {
    setExportSourceId(value ? (value as Id<"helpCenterImportSources">) : undefined);
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
          if (file.type === "markdown") {
            archiveFiles[file.path] = strToU8(file.content ?? "");
          }
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

  const filteredArticles = filterArticles(
    articles,
    searchQuery,
    collectionFilter,
    visibilityFilter,
    statusFilter
  );
  const selectedImportPaths = selectedImportItems.map((item) => item.relativePath);
  const selectedImportAssetPaths = selectedImportAssetItems.map((item) => item.relativePath);
  const hasCurrentPreview = Boolean(
    importPreview && previewSignature && previewSignature === currentImportSignature
  );
  const isPreviewStale = Boolean(importPreview && previewSignature !== currentImportSignature);
  const collectionFilterItems = buildCollectionFilterItems(articles, collections);
  const hasArticles = (articles?.length ?? 0) > 0;
  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    collectionFilter !== ALL_COLLECTION_FILTER ||
    visibilityFilter !== ALL_VISIBILITY_FILTER ||
    statusFilter !== ALL_STATUS_FILTER;

  const clearAllFilters = () => {
    setSearchQuery("");
    setCollectionFilter(ALL_COLLECTION_FILTER);
    setVisibilityFilter(ALL_VISIBILITY_FILTER);
    setStatusFilter(ALL_STATUS_FILTER);
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Articles</h1>
          <p className="text-gray-500">Manage public and internal knowledge articles</p>
        </div>
        <div className="flex gap-2">
          <Link href="/articles/collections">
            <Button variant="outline">Manage Collections</Button>
          </Link>
          <Button variant="outline" onClick={() => void handleCreateArticle("internal")}>
            <Plus className="h-4 w-4 mr-2" />
            New Internal Article
          </Button>
          <Button onClick={() => void handleCreateArticle("public")}>
            <Plus className="h-4 w-4 mr-2" />
            New Article
          </Button>
        </div>
      </div>

      <ArticlesImportSection
        folderInputRef={folderInputRef}
        collections={collections}
        importSources={importSources}
        importHistory={importHistory}
        importSourceName={importSourceName}
        importTargetCollectionId={importTargetCollectionId}
        selectedImportPaths={selectedImportPaths}
        selectedImportAssetPaths={selectedImportAssetPaths}
        importPreview={importPreview}
        hasCurrentPreview={hasCurrentPreview}
        isPreviewStale={isPreviewStale}
        isPreviewingImport={isPreviewingImport}
        isImporting={isImporting}
        isExporting={isExporting}
        exportSourceId={exportSourceId}
        importError={importError}
        importNotice={importNotice}
        restoringRunId={restoringRunId}
        onFolderSelection={handleImportFolderSelection}
        onImportSourceNameChange={handleImportSourceNameChange}
        onImportTargetCollectionChange={handleImportTargetCollectionChange}
        onPreviewImport={handlePreviewImport}
        onStartImport={handleStartImport}
        onExportSourceChange={handleExportSourceChange}
        onExportMarkdown={handleExportMarkdown}
        onRestoreRun={handleRestoreRun}
      />

      <ArticlesListSection
        searchQuery={searchQuery}
        collectionFilter={collectionFilter}
        visibilityFilter={visibilityFilter}
        statusFilter={statusFilter}
        collectionFilterItems={collectionFilterItems}
        filteredArticles={filteredArticles}
        collections={collections}
        hasArticles={hasArticles}
        hasActiveFilters={hasActiveFilters}
        onSearchQueryChange={setSearchQuery}
        onCollectionFilterChange={setCollectionFilter}
        onVisibilityFilterChange={setVisibilityFilter}
        onStatusFilterChange={setStatusFilter}
        onClearAllFilters={clearAllFilters}
        onCreateArticle={() => void handleCreateArticle("public")}
        onCreateInternalArticle={() => void handleCreateArticle("internal")}
        onTogglePublish={handleTogglePublish}
        onDeleteRequest={handleDeleteRequest}
      />

      <DeleteArticleDialog
        target={deleteTarget}
        error={deleteError}
        isDeleting={isDeletingArticle}
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
      />
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
