"use client";

import Link from "next/link";
import { Button, Input } from "@opencom/ui";
import { Eye, EyeOff, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
import type {
  ArticleEditorId,
  ArticleListItem,
  CollectionFilter,
  CollectionFilterItem,
  CollectionListItem,
} from "./articlesAdminTypes";
import {
  ALL_STATUS_FILTER,
  ALL_VISIBILITY_FILTER,
  formatDate,
  getArticleCollectionFilter,
  getCollectionName,
  type StatusFilter,
  type VisibilityFilter,
} from "./articlesAdminUtils";

type ArticlesListSectionProps = {
  searchQuery: string;
  collectionFilter: CollectionFilter;
  visibilityFilter: VisibilityFilter;
  statusFilter: StatusFilter;
  collectionFilterItems: CollectionFilterItem[];
  filteredArticles: ArticleListItem[];
  collections: CollectionListItem[] | undefined;
  hasArticles: boolean;
  hasActiveFilters: boolean;
  onSearchQueryChange: (value: string) => void;
  onCollectionFilterChange: (value: CollectionFilter) => void;
  onVisibilityFilterChange: (value: VisibilityFilter) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onClearAllFilters: () => void;
  onCreateArticle: () => void;
  onCreateInternalArticle: () => void;
  onTogglePublish: (id: ArticleEditorId, isPublished: boolean) => void;
  onDeleteRequest: (id: ArticleEditorId, title: string) => void;
};

export function ArticlesListSection({
  searchQuery,
  collectionFilter,
  visibilityFilter,
  statusFilter,
  collectionFilterItems,
  filteredArticles,
  collections,
  hasArticles,
  hasActiveFilters,
  onSearchQueryChange,
  onCollectionFilterChange,
  onVisibilityFilterChange,
  onStatusFilterChange,
  onClearAllFilters,
  onCreateArticle,
  onCreateInternalArticle,
  onTogglePublish,
  onDeleteRequest,
}: ArticlesListSectionProps) {
  return (
    <>
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="pl-10"
          />
        </div>
        <select
          value={visibilityFilter}
          onChange={(event) => onVisibilityFilterChange(event.target.value as VisibilityFilter)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value={ALL_VISIBILITY_FILTER}>All visibility</option>
          <option value="public">Public</option>
          <option value="internal">Internal</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value as StatusFilter)}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value={ALL_STATUS_FILTER}>All status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onClearAllFilters}>
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
              onClick={() => onCollectionFilterChange(filterItem.id)}
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

      {filteredArticles.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {hasArticles ? "No matching articles" : "No articles yet"}
          </h3>
          <p className="text-gray-500 mb-4">
            {hasArticles
              ? "Try another search term or collection filter."
              : "Create your first article to help your team or your customers"}
          </p>
          {hasArticles ? (
            <Button variant="outline" onClick={onClearAllFilters}>
              Clear filters
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={onCreateInternalArticle}>
                <Plus className="h-4 w-4 mr-2" />
                Create Internal Article
              </Button>
              <Button onClick={onCreateArticle}>
                <Plus className="h-4 w-4 mr-2" />
                Create Article
              </Button>
            </div>
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
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Visibility
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Updated</th>
                <th className="w-[120px] px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredArticles.map((article) => {
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
                        onClick={() => onCollectionFilterChange(articleCollectionFilter)}
                        className={`transition-colors hover:text-primary hover:underline ${
                          collectionFilter === articleCollectionFilter
                            ? "text-primary underline"
                            : "text-gray-500"
                        }`}
                      >
                        {getCollectionName(article.collectionId, collections)}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          (article.visibility ?? "public") === "internal"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {(article.visibility ?? "public") === "internal" ? "Internal" : "Public"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          article.status === "published"
                            ? "bg-green-100 text-green-800"
                            : article.status === "archived"
                              ? "bg-amber-100 text-amber-800"
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
                          onClick={() => onTogglePublish(article._id, article.status === "published")}
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
                          onClick={() => onDeleteRequest(article._id, article.title)}
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
    </>
  );
}
