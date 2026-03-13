"use client";

import type { ChangeEvent, MutableRefObject } from "react";
import type { Id } from "@opencom/convex/dataModel";
import { Button, Input } from "@opencom/ui";
import { Download, History, Upload } from "lucide-react";
import {
  type CollectionListItem,
  type ImportHistoryListItem,
  type ImportSourceListItem,
  type MarkdownImportPreview,
} from "./articlesAdminTypes";
import { formatPreviewPathSample, getCollectionLabel } from "./articlesAdminUtils";

type ArticlesImportSectionProps = {
  folderInputRef: MutableRefObject<HTMLInputElement | null>;
  collections: CollectionListItem[] | undefined;
  importSources: ImportSourceListItem[] | undefined;
  importHistory: ImportHistoryListItem[] | undefined;
  importSourceName: string;
  importTargetCollectionId: Id<"collections"> | undefined;
  selectedImportPaths: string[];
  selectedImportAssetPaths: string[];
  importPreview: MarkdownImportPreview | null;
  hasCurrentPreview: boolean;
  isPreviewStale: boolean;
  isPreviewingImport: boolean;
  isImporting: boolean;
  isExporting: boolean;
  exportSourceId: Id<"helpCenterImportSources"> | undefined;
  importError: string | null;
  importNotice: string | null;
  restoringRunId: string | null;
  onFolderSelection: (event: ChangeEvent<HTMLInputElement>) => void;
  onImportSourceNameChange: (value: string) => void;
  onImportTargetCollectionChange: (value: string) => void;
  onPreviewImport: () => void;
  onStartImport: () => void;
  onExportSourceChange: (value: string) => void;
  onExportMarkdown: () => void;
  onRestoreRun: (sourceId: Id<"helpCenterImportSources">, importRunId: string) => void;
};

export function ArticlesImportSection({
  folderInputRef,
  collections,
  importSources,
  importHistory,
  importSourceName,
  importTargetCollectionId,
  selectedImportPaths,
  selectedImportAssetPaths,
  importPreview,
  hasCurrentPreview,
  isPreviewStale,
  isPreviewingImport,
  isImporting,
  isExporting,
  exportSourceId,
  importError,
  importNotice,
  restoringRunId,
  onFolderSelection,
  onImportSourceNameChange,
  onImportTargetCollectionChange,
  onPreviewImport,
  onStartImport,
  onExportSourceChange,
  onExportMarkdown,
  onRestoreRun,
}: ArticlesImportSectionProps): React.JSX.Element {
  return (
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
            Imports normalize folder uploads on the backend so the selected upload root folder does
            not become an extra collection level.
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
          onChange={onFolderSelection}
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
            onChange={(event) => onImportSourceNameChange(event.target.value)}
            placeholder="docs"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Import Into Collection
          </label>
          <select
            value={importTargetCollectionId ?? ""}
            onChange={(event) => onImportTargetCollectionChange(event.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Workspace root</option>
            {collections?.map((collection) => (
              <option key={collection._id} value={collection._id}>
                {getCollectionLabel(collection._id, collections)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(selectedImportPaths.length > 0 || selectedImportAssetPaths.length > 0) && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div data-testid="markdown-import-selection-count" className="text-sm text-gray-700 mb-1">
            {selectedImportPaths.length} markdown file{selectedImportPaths.length !== 1 ? "s" : ""}{" "}
            and {selectedImportAssetPaths.length} image file
            {selectedImportAssetPaths.length !== 1 ? "s" : ""} selected
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
              Collections: +{importPreview.createdCollections} / ~{importPreview.updatedCollections}{" "}
              / -{importPreview.deletedCollections}
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
          onClick={onPreviewImport}
          disabled={isPreviewingImport || isImporting || selectedImportPaths.length === 0}
        >
          {isPreviewingImport ? "Previewing..." : "Preview Changes"}
        </Button>
        <Button
          data-testid="markdown-import-sync-button"
          onClick={onStartImport}
          disabled={
            isImporting || isPreviewingImport || selectedImportPaths.length === 0 || !hasCurrentPreview
          }
        >
          {isImporting ? "Applying..." : "Apply Import"}
        </Button>
        <select
          value={exportSourceId ?? ""}
          onChange={(event) => onExportSourceChange(event.target.value)}
          className="px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <option value="">Export all docs</option>
          {importSources?.map((source) => (
            <option key={source._id} value={source._id}>
              {source.sourceName}
            </option>
          ))}
        </select>
        <Button
          data-testid="markdown-export-button"
          variant="outline"
          onClick={onExportMarkdown}
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
            {importSources?.map((source) => (
              <div key={source._id} className="flex items-center justify-between">
                <span>
                  {source.sourceName}
                  {source.rootCollectionName ? ` -> ${source.rootCollectionName}` : " -> root"}
                </span>
                <span className="text-xs text-gray-500">{source.lastImportedFileCount ?? 0} files</span>
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
            {importHistory?.map((run) => (
              <div
                key={`${run.sourceId}-${run.importRunId}`}
                className="border rounded-md px-3 py-2 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-medium">{run.sourceName}</div>
                  <div className="text-xs text-gray-500">
                    Removed {run.deletedArticles} article{run.deletedArticles !== 1 ? "s" : ""}
                    {" + "}
                    {run.deletedCollections} collection{run.deletedCollections !== 1 ? "s" : ""}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={run.restorableEntries === 0 || restoringRunId === run.importRunId}
                  onClick={() => onRestoreRun(run.sourceId, run.importRunId)}
                >
                  {restoringRunId === run.importRunId ? "Restoring..." : "Restore"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
