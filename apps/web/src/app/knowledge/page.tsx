"use client";

import { useState, DragEvent } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import {
  Plus,
  Search,
  FileText,
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Pencil,
  Trash2,
  BookOpen,
  MessageSquareText,
  Filter,
  LayoutGrid,
  List,
  GripVertical,
} from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";

type ContentType = "article" | "internalArticle" | "snippet";

interface FolderNode {
  _id: Id<"contentFolders">;
  name: string;
  parentId?: Id<"contentFolders">;
  order: number;
  children: FolderNode[];
}

function FolderTreeItem({
  folder,
  level,
  selectedFolderId,
  onSelect,
  onRename,
  onDelete,
  dropTargetFolderId,
  onDragOver,
  onDragLeave,
  onDrop,
  draggedItem,
}: {
  folder: FolderNode;
  level: number;
  selectedFolderId?: Id<"contentFolders">;
  onSelect: (id?: Id<"contentFolders">) => void;
  onRename: (id: Id<"contentFolders">, name: string) => void;
  onDelete: (id: Id<"contentFolders">) => void;
  dropTargetFolderId?: Id<"contentFolders"> | "root" | null;
  onDragOver?: (e: DragEvent<HTMLDivElement>, folderId: Id<"contentFolders">) => void;
  onDragLeave?: () => void;
  onDrop?: (e: DragEvent<HTMLDivElement>, folderId: Id<"contentFolders">) => void;
  draggedItem?: { id: string; type: ContentType } | null;
}) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);

  const hasChildren = folder.children.length > 0;
  const isSelected = selectedFolderId === folder._id;

  const handleRename = () => {
    if (editName.trim() && editName !== folder.name) {
      onRename(folder._id, editName.trim());
    }
    setIsEditing(false);
  };

  const isDropTarget = dropTargetFolderId === folder._id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer group transition-colors ${
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-gray-100"
        } ${isDropTarget ? "ring-2 ring-primary bg-primary/5" : ""}`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(folder._id)}
        onDragOver={(e) => onDragOver?.(e, folder._id)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop?.(e, folder._id)}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          className="p-0.5 hover:bg-gray-200 rounded"
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : (
            <span className="w-4" />
          )}
        </button>
        {isExpanded ? (
          <FolderOpen className="h-4 w-4 text-yellow-500" />
        ) : (
          <Folder className="h-4 w-4 text-yellow-500" />
        )}
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") setIsEditing(false);
            }}
            className="flex-1 px-1 text-sm border rounded"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span data-testid="folder-name-label" className="flex-1 text-sm truncate">
            {folder.name}
          </span>
        )}
        <div className="relative">
          <button
            data-testid="folder-menu-trigger"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 rounded"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-white border rounded-md shadow-lg z-10 py-1 min-w-[120px]">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
              >
                <Pencil className="h-3 w-3" />
                Rename
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(folder._id);
                  setShowMenu(false);
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-red-600"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child._id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              dropTargetFolderId={dropTargetFolderId}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              draggedItem={draggedItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DragItem {
  id: string;
  type: ContentType;
}

function KnowledgeContent() {
  const { activeWorkspace } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<Id<"contentFolders"> | undefined>();
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType[]>([
    "article",
    "internalArticle",
    "snippet",
  ]);
  const [showFilters, setShowFilters] = useState(false);
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<
    Id<"contentFolders"> | "root" | null
  >(null);

  const folders = useQuery(
    api.contentFolders.listTree,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const searchResults = useQuery(
    api.knowledge.search,
    activeWorkspace?._id && searchQuery.length > 0
      ? {
          workspaceId: activeWorkspace._id,
          query: searchQuery,
          contentTypes: contentTypeFilter,
          folderId: selectedFolderId,
        }
      : "skip"
  );

  const articles = useQuery(
    api.articles.list,
    activeWorkspace?._id && !searchQuery ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const internalArticles = useQuery(
    api.internalArticles.list,
    activeWorkspace?._id && !searchQuery ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const snippets = useQuery(
    api.snippets.list,
    activeWorkspace?._id && !searchQuery ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const createFolder = useMutation(api.contentFolders.create);
  const updateFolder = useMutation(api.contentFolders.update);
  const deleteFolder = useMutation(api.contentFolders.remove);
  const updateArticle = useMutation(api.articles.update);
  const updateInternalArticle = useMutation(api.internalArticles.update);
  const updateSnippet = useMutation(api.snippets.update);

  const handleCreateFolder = async () => {
    if (!activeWorkspace?._id) return;
    await createFolder({
      workspaceId: activeWorkspace._id,
      name: "New Folder",
      parentId: selectedFolderId,
    });
  };

  const handleRenameFolder = async (id: Id<"contentFolders">, name: string) => {
    await updateFolder({ id, name });
  };

  const handleDeleteFolder = async (id: Id<"contentFolders">) => {
    if (confirm("Are you sure you want to delete this folder? Contents will be moved to root.")) {
      await deleteFolder({ id });
      if (selectedFolderId === id) {
        setSelectedFolderId(undefined);
      }
    }
  };

  const handleDragStart = (
    e: DragEvent<HTMLTableRowElement | HTMLAnchorElement>,
    item: DragItem
  ) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(item));
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDropTargetFolderId(null);
  };

  const handleDragOver = (
    e: DragEvent<HTMLDivElement>,
    folderId: Id<"contentFolders"> | "root"
  ) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetFolderId(folderId);
  };

  const handleDragLeave = () => {
    setDropTargetFolderId(null);
  };

  const handleDrop = async (
    e: DragEvent<HTMLDivElement>,
    targetFolderId: Id<"contentFolders"> | "root"
  ) => {
    e.preventDefault();
    setDropTargetFolderId(null);

    if (!draggedItem) return;

    const newFolderId = targetFolderId === "root" ? undefined : targetFolderId;

    try {
      if (draggedItem.type === "article") {
        await updateArticle({
          id: draggedItem.id as Id<"articles">,
          folderId: newFolderId,
        });
      } else if (draggedItem.type === "internalArticle") {
        await updateInternalArticle({
          id: draggedItem.id as Id<"internalArticles">,
          folderId: newFolderId,
        });
      } else if (draggedItem.type === "snippet") {
        await updateSnippet({
          id: draggedItem.id as Id<"snippets">,
          folderId: newFolderId,
        });
      }
    } catch (error) {
      console.error("Failed to move content:", error);
    }

    setDraggedItem(null);
  };

  const toggleContentType = (type: ContentType) => {
    if (contentTypeFilter.includes(type)) {
      if (contentTypeFilter.length > 1) {
        setContentTypeFilter(contentTypeFilter.filter((t) => t !== type));
      }
    } else {
      setContentTypeFilter([...contentTypeFilter, type]);
    }
  };

  const getContentTypeIcon = (type: ContentType) => {
    switch (type) {
      case "article":
        return <FileText className="h-4 w-4 text-primary-foreground0" />;
      case "internalArticle":
        return <BookOpen className="h-4 w-4 text-purple-500" />;
      case "snippet":
        return <MessageSquareText className="h-4 w-4 text-green-500" />;
    }
  };

  const getContentTypeLabel = (type: ContentType) => {
    switch (type) {
      case "article":
        return "Article";
      case "internalArticle":
        return "Internal";
      case "snippet":
        return "Snippet";
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Combine all content when not searching
  const allContent = !searchQuery
    ? [
        ...(articles
          ?.filter(
            (a: NonNullable<typeof articles>[number]) =>
              contentTypeFilter.includes("article") &&
              (!selectedFolderId || a.folderId === selectedFolderId)
          )
          .map((a: NonNullable<typeof articles>[number]) => ({
            id: a._id,
            type: "article" as const,
            title: a.title,
            content: a.content,
            updatedAt: a.updatedAt,
            status: a.status,
          })) || []),
        ...(internalArticles
          ?.filter(
            (a: NonNullable<typeof internalArticles>[number]) =>
              contentTypeFilter.includes("internalArticle") &&
              (!selectedFolderId || a.folderId === selectedFolderId)
          )
          .map((a: NonNullable<typeof internalArticles>[number]) => ({
            id: a._id,
            type: "internalArticle" as const,
            title: a.title,
            content: a.content,
            updatedAt: a.updatedAt,
            status: a.status,
            tags: a.tags,
          })) || []),
        ...(snippets
          ?.filter(
            (s: NonNullable<typeof snippets>[number]) =>
              contentTypeFilter.includes("snippet") &&
              (!selectedFolderId || s.folderId === selectedFolderId)
          )
          .map((s: NonNullable<typeof snippets>[number]) => ({
            id: s._id,
            type: "snippet" as const,
            title: s.name,
            content: s.content,
            updatedAt: s.updatedAt,
          })) || []),
      ].sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  const displayContent = searchQuery ? searchResults : allContent;

  return (
    <div className="flex h-full">
      {/* Sidebar - Folder Tree */}
      <div
        data-testid="knowledge-folder-sidebar"
        className="w-64 border-r bg-gray-50 flex flex-col"
      >
        <div className="p-3 border-b flex items-center justify-between">
          <h2 className="font-semibold text-sm">Folders</h2>
          <Button variant="ghost" size="sm" onClick={handleCreateFolder}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <div
            className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${
              !selectedFolderId ? "bg-primary/10 text-primary" : "hover:bg-gray-100"
            } ${dropTargetFolderId === "root" ? "ring-2 ring-primary bg-primary/5" : ""}`}
            onClick={() => setSelectedFolderId(undefined)}
            onDragOver={(e) => handleDragOver(e, "root")}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, "root")}
          >
            <FolderOpen className="h-4 w-4" />
            <span className="text-sm">All Content</span>
            {dropTargetFolderId === "root" && draggedItem && (
              <span className="text-xs text-primary ml-auto">Drop here</span>
            )}
          </div>
          {folders?.map((folder: NonNullable<typeof folders>[number]) => (
            <FolderTreeItem
              key={folder._id}
              folder={folder as FolderNode}
              level={0}
              selectedFolderId={selectedFolderId}
              onSelect={setSelectedFolderId}
              onRename={handleRenameFolder}
              onDelete={handleDeleteFolder}
              dropTargetFolderId={dropTargetFolderId}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              draggedItem={draggedItem}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold">Knowledge Hub</h1>
              <p className="text-gray-500">Search and manage all your support content</p>
            </div>
            <div className="flex gap-2">
              <Link href="/knowledge/internal/new">
                <Button variant="outline">
                  <BookOpen className="h-4 w-4 mr-2" />
                  New Internal Article
                </Button>
              </Link>
              <Link href="/articles">
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  Manage Articles
                </Button>
              </Link>
              <Link href="/snippets">
                <Button variant="outline">
                  <MessageSquareText className="h-4 w-4 mr-2" />
                  Manage Snippets
                </Button>
              </Link>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search all content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className={showFilters ? "bg-gray-100" : ""}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
            <div className="flex border rounded-md">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 ${viewMode === "list" ? "bg-gray-100" : ""}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 ${viewMode === "grid" ? "bg-gray-100" : ""}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          {showFilters && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-sm text-gray-500">Content type:</span>
              {(["article", "internalArticle", "snippet"] as ContentType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => toggleContentType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm ${
                    contentTypeFilter.includes(type)
                      ? "bg-primary/10 text-primary"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {getContentTypeIcon(type)}
                  {getContentTypeLabel(type)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content List */}
        <div className="flex-1 overflow-y-auto p-4">
          {displayContent?.length === 0 ? (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {searchQuery ? "No results found" : "No content yet"}
              </h3>
              <p className="text-gray-500">
                {searchQuery
                  ? "Try adjusting your search or filters"
                  : "Create articles, internal docs, or snippets to get started"}
              </p>
            </div>
          ) : viewMode === "list" ? (
            <div className="border rounded-lg bg-white overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Title</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 w-[100px]">
                      Type
                    </th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-gray-600 w-[100px]">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {displayContent?.map((item: NonNullable<typeof displayContent>[number]) => (
                    <tr
                      key={`${item.type}-${item.id}`}
                      className="hover:bg-gray-50 cursor-grab active:cursor-grabbing"
                      draggable
                      onDragStart={(e) => handleDragStart(e, { id: item.id, type: item.type })}
                      onDragEnd={handleDragEnd}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <Link
                            href={
                              item.type === "article"
                                ? `/articles/${item.id}`
                                : item.type === "internalArticle"
                                  ? `/knowledge/internal/${item.id}`
                                  : `/snippets`
                            }
                            className="flex items-center gap-2 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {getContentTypeIcon(item.type)}
                            <span className="font-medium text-primary hover:underline">
                              {item.title}
                            </span>
                          </Link>
                        </div>
                        {searchQuery && "snippet" in item && item.snippet && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-1">{item.snippet}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            item.type === "article"
                              ? "bg-primary/10 text-primary"
                              : item.type === "internalArticle"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-green-100 text-green-800"
                          }`}
                        >
                          {getContentTypeLabel(item.type)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-sm">
                        {formatDate(item.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {displayContent?.map((item: NonNullable<typeof displayContent>[number]) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={
                    item.type === "article"
                      ? `/articles/${item.id}`
                      : item.type === "internalArticle"
                        ? `/knowledge/internal/${item.id}`
                        : `/snippets`
                  }
                  className="border rounded-lg bg-white p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {getContentTypeIcon(item.type)}
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        item.type === "article"
                          ? "bg-primary/10 text-primary"
                          : item.type === "internalArticle"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-green-100 text-green-800"
                      }`}
                    >
                      {getContentTypeLabel(item.type)}
                    </span>
                  </div>
                  <h3 className="font-medium mb-1 line-clamp-2">{item.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2">{item.content.slice(0, 100)}</p>
                  <p className="text-xs text-gray-400 mt-2">Updated {formatDate(item.updatedAt)}</p>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <AppLayout>
      <KnowledgeContent />
    </AppLayout>
  );
}
