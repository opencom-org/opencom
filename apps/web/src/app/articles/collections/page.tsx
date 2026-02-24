"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Input } from "@opencom/ui";
import { ArrowLeft, Plus, Pencil, Trash2, FolderOpen } from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";

interface CollectionFormData {
  name: string;
  description: string;
  icon: string;
}

export default function CollectionsPage() {
  const { activeWorkspace } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"collections"> | null>(null);
  const [formData, setFormData] = useState<CollectionFormData>({
    name: "",
    description: "",
    icon: "",
  });

  const collections = useQuery(
    api.collections.listHierarchy,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const createCollection = useMutation(api.collections.create);
  const updateCollection = useMutation(api.collections.update);
  const deleteCollection = useMutation(api.collections.remove);

  const handleOpenModal = (collection?: NonNullable<typeof collections>[number]) => {
    if (collection) {
      setEditingId(collection._id);
      setFormData({
        name: collection.name,
        description: collection.description || "",
        icon: collection.icon || "",
      });
    } else {
      setEditingId(null);
      setFormData({ name: "", description: "", icon: "" });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData({ name: "", description: "", icon: "" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?._id) return;

    try {
      if (editingId) {
        await updateCollection({
          id: editingId,
          name: formData.name,
          description: formData.description || undefined,
          icon: formData.icon || undefined,
        });
      } else {
        await createCollection({
          workspaceId: activeWorkspace._id,
          name: formData.name,
          description: formData.description || undefined,
          icon: formData.icon || undefined,
        });
      }
      handleCloseModal();
    } catch (error) {
      console.error("Failed to save collection:", error);
    }
  };

  const handleDelete = async (id: Id<"collections">) => {
    if (confirm("Are you sure you want to delete this collection?")) {
      try {
        await deleteCollection({ id });
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to delete collection");
      }
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/articles">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Articles
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Collections</h1>
            <p className="text-gray-500">Organize your articles into categories</p>
          </div>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <Plus className="h-4 w-4 mr-2" />
          New Collection
        </Button>
      </div>

      {collections?.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <FolderOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No collections yet</h3>
          <p className="text-gray-500 mb-4">Create collections to organize your articles</p>
          <Button onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Create Collection
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {collections?.map((collection: NonNullable<typeof collections>[number]) => (
            <div
              key={collection._id}
              className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center text-xl">
                    {collection.icon || "📁"}
                  </div>
                  <div>
                    <h3 className="font-medium">{collection.name}</h3>
                    <p className="text-sm text-gray-500">
                      {collection.articleCount} article{collection.articleCount !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleOpenModal(collection)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(collection._id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              {collection.description && (
                <p className="mt-2 text-sm text-gray-600">{collection.description}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">
              {editingId ? "Edit Collection" : "New Collection"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Collection name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon (emoji)</label>
                <Input
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  placeholder="📁"
                  maxLength={2}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={handleCloseModal}>
                  Cancel
                </Button>
                <Button type="submit">{editingId ? "Save Changes" : "Create Collection"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
