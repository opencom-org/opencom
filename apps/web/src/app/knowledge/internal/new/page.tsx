"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { ArrowLeft, Save, Eye, X, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Id } from "@opencom/convex/dataModel";

function NewInternalArticleContent() {
  const { activeWorkspace, user } = useAuth();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  const folders = useQuery(
    api.contentFolders.listTree,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const createArticle = useMutation(api.internalArticles.create);

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSave = async () => {
    if (!activeWorkspace?._id || !title.trim()) return;

    setIsSaving(true);
    try {
      const articleId = await createArticle({
        workspaceId: activeWorkspace._id,
        title: title.trim(),
        content,
        tags: tags.length > 0 ? tags : undefined,
        folderId: selectedFolderId as Id<"contentFolders"> | undefined,
        authorId: user?._id,
      });
      router.push(`/knowledge/internal/${articleId}`);
    } catch (error) {
      console.error("Failed to create article:", error);
    } finally {
      setIsSaving(false);
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
              <h1 className="text-lg font-semibold">New Internal Article</h1>
              <p className="text-sm text-gray-500">Create agent-only documentation</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleSave} disabled={!title.trim() || isSaving}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Draft"}
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
              onChange={(e) => setTitle(e.target.value)}
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
                onChange={(e) => setSelectedFolderId(e.target.value || undefined)}
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
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your article content here...

You can include:
- Step-by-step procedures
- Troubleshooting guides
- Internal policies
- Reference documentation"
              className="w-full h-full min-h-[400px] border-none outline-none resize-none text-gray-700 placeholder:text-gray-300"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NewInternalArticlePage() {
  return (
    <AppLayout>
      <NewInternalArticleContent />
    </AppLayout>
  );
}
