"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { ArrowLeft, Save, X, Plus, Globe, GlobeLock, Archive, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import type { Id } from "@opencom/convex/dataModel";

function InternalArticleEditorContent() {
  const { activeWorkspace } = useAuth();
  const router = useRouter();
  const params = useParams();
  const articleId = params.id as Id<"internalArticles">;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const article = useQuery(api.internalArticles.get, { id: articleId });

  const folders = useQuery(
    api.contentFolders.listTree,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const updateArticle = useMutation(api.internalArticles.update);
  const publishArticle = useMutation(api.internalArticles.publish);
  const unpublishArticle = useMutation(api.internalArticles.unpublish);
  const archiveArticle = useMutation(api.internalArticles.archive);
  const deleteArticle = useMutation(api.internalArticles.remove);

  // Initialize form with article data
  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setContent(article.content);
      setTags(article.tags || []);
      setSelectedFolderId(article.folderId);
    }
  }, [article]);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
      setHasChanges(true);
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
    setHasChanges(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;

    setIsSaving(true);
    try {
      await updateArticle({
        id: articleId,
        title: title.trim(),
        content,
        tags: tags.length > 0 ? tags : undefined,
        folderId: selectedFolderId as Id<"contentFolders"> | undefined,
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save article:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublish = async () => {
    await handleSave();
    await publishArticle({ id: articleId });
  };

  const handleUnpublish = async () => {
    await unpublishArticle({ id: articleId });
  };

  const handleArchive = async () => {
    if (confirm("Are you sure you want to archive this article?")) {
      await archiveArticle({ id: articleId });
      router.push("/knowledge");
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this article? This cannot be undone.")) {
      await deleteArticle({ id: articleId });
      router.push("/knowledge");
    }
  };

  // Flatten folders for select dropdown
  const flattenFolders = (
    items: typeof folders,
    level = 0
  ): { id: string; name: string; level: number }[] => {
    if (!items) return [];
    const result: { id: string; name: string; level: number }[] = [];
    for (const item of items) {
      result.push({ id: item._id, name: item.name, level });
      if (item.children) {
        result.push(...flattenFolders(item.children as typeof folders, level + 1));
      }
    }
    return result;
  };

  const flatFolders = flattenFolders(folders);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (!article) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/knowledge">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold">Edit Internal Article</h1>
                <span
                  className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                    article.status === "published"
                      ? "bg-green-100 text-green-800"
                      : article.status === "archived"
                        ? "bg-gray-100 text-gray-800"
                        : "bg-yellow-100 text-yellow-800"
                  }`}
                >
                  {article.status}
                </span>
              </div>
              <p className="text-sm text-gray-500">Last updated {formatDate(article.updatedAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {article.status === "published" ? (
              <Button variant="outline" onClick={handleUnpublish}>
                <GlobeLock className="h-4 w-4 mr-2" />
                Unpublish
              </Button>
            ) : article.status !== "archived" ? (
              <Button variant="outline" onClick={handlePublish}>
                <Globe className="h-4 w-4 mr-2" />
                Publish
              </Button>
            ) : null}
            {article.status !== "archived" && (
              <Button variant="outline" onClick={handleArchive}>
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleDelete}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button onClick={handleSave} disabled={!title.trim() || isSaving || !hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6">
          {/* Title */}
          <div className="mb-6">
            <input
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Article title..."
              className="w-full text-3xl font-bold border-none outline-none placeholder:text-gray-300"
            />
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-6 mb-6 pb-6 border-b">
            {/* Folder */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">Folder:</label>
              <select
                value={selectedFolderId || ""}
                onChange={(e) => {
                  setSelectedFolderId(e.target.value || undefined);
                  setHasChanges(true);
                }}
                className="text-sm border rounded-md px-2 py-1"
              >
                <option value="">No folder</option>
                {flatFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {"  ".repeat(folder.level)}
                    {folder.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-2 flex-1">
              <label className="text-sm text-gray-500">Tags:</label>
              <div className="flex items-center gap-1 flex-wrap">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 text-xs rounded-full"
                  >
                    {tag}
                    <button onClick={() => handleRemoveTag(tag)} className="hover:text-purple-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <Input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddTag();
                      }
                    }}
                    placeholder="Add tag..."
                    className="h-6 w-24 text-xs"
                  />
                  <button onClick={handleAddTag} className="p-1 hover:bg-gray-100 rounded">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Content Editor */}
          <div className="min-h-[400px]">
            <textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setHasChanges(true);
              }}
              placeholder="Write your article content here..."
              className="w-full h-full min-h-[400px] border-none outline-none resize-none text-gray-700 placeholder:text-gray-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InternalArticleEditorPage() {
  return (
    <AppLayout>
      <InternalArticleEditorContent />
    </AppLayout>
  );
}
