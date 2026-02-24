"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { Plus, Pencil, Trash2, MessageSquare, Search } from "lucide-react";
import type { Id } from "@opencom/convex/dataModel";

interface SnippetFormData {
  name: string;
  content: string;
  shortcut: string;
}

function SnippetsContent() {
  const { activeWorkspace } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"snippets"> | null>(null);
  const [formData, setFormData] = useState<SnippetFormData>({
    name: "",
    content: "",
    shortcut: "",
  });

  const snippets = useQuery(
    api.snippets.list,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const createSnippet = useMutation(api.snippets.create);
  const updateSnippet = useMutation(api.snippets.update);
  const deleteSnippet = useMutation(api.snippets.remove);

  const handleOpenModal = (snippet?: NonNullable<typeof snippets>[number]) => {
    if (snippet) {
      setEditingId(snippet._id);
      setFormData({
        name: snippet.name,
        content: snippet.content,
        shortcut: snippet.shortcut || "",
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", content: "", shortcut: "" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: "", content: "", shortcut: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?._id) return;

    try {
      if (editingId) {
        await updateSnippet({
          id: editingId,
          name: formData.name,
          content: formData.content,
          shortcut: formData.shortcut || undefined,
        });
      } else {
        await createSnippet({
          workspaceId: activeWorkspace._id,
          name: formData.name,
          content: formData.content,
          shortcut: formData.shortcut || undefined,
        });
      }
      handleCloseModal();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to save snippet");
    }
  };

  const handleDelete = async (id: Id<"snippets">) => {
    if (confirm("Are you sure you want to delete this snippet?")) {
      await deleteSnippet({ id });
    }
  };

  const filteredSnippets = snippets?.filter(
    (snippet: NonNullable<typeof snippets>[number]) =>
      snippet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      snippet.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (snippet.shortcut && snippet.shortcut.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Snippets</h1>
          <p className="text-gray-500">Saved replies for quick responses</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          New Snippet
        </Button>
      </div>

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search snippets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {filteredSnippets?.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <MessageSquare className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No snippets yet</h3>
          <p className="text-gray-500 mb-4">Create snippets to speed up your responses</p>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Snippet
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredSnippets?.map((snippet: NonNullable<typeof snippets>[number]) => (
            <div
              key={snippet._id}
              className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-medium">{snippet.name}</h3>
                  {snippet.shortcut && (
                    <span className="inline-flex px-2 py-0.5 text-xs font-mono bg-gray-100 rounded mt-1">
                      /{snippet.shortcut}
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenModal(snippet)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(snippet._id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm text-gray-600 line-clamp-3">{snippet.content}</p>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-bold mb-4">{editingId ? "Edit Snippet" : "New Snippet"}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Greeting"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shortcut (optional)
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">/</span>
                  <Input
                    value={formData.shortcut}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        shortcut: e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase(),
                      })
                    }
                    placeholder="greeting"
                    className="font-mono"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Type /{formData.shortcut || "shortcut"} in the composer to insert this snippet
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Hi there! How can I help you today?"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={5}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit">{editingId ? "Save Changes" : "Create Snippet"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SnippetsPage() {
  return (
    <AppLayout>
      <SnippetsContent />
    </AppLayout>
  );
}
