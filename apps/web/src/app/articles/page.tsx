"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import { Plus, Search, FileText, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";

function ArticlesContent() {
  const router = useRouter();
  const { activeWorkspace } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");

  const articles = useQuery(
    api.articles.list,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const collections = useQuery(
    api.collections.listHierarchy,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const createArticle = useMutation(api.articles.create);
  const deleteArticle = useMutation(api.articles.remove);
  const publishArticle = useMutation(api.articles.publish);
  const unpublishArticle = useMutation(api.articles.unpublish);

  const handleCreateArticle = async () => {
    if (!activeWorkspace?._id) return;
    const articleId = await createArticle({
      workspaceId: activeWorkspace._id,
      title: "Untitled Article",
      content: "",
    });
    router.push(`/articles/${articleId}`);
  };

  const handleDelete = async (id: Id<"articles">) => {
    if (confirm("Are you sure you want to delete this article?")) {
      await deleteArticle({ id });
    }
  };

  const handleTogglePublish = async (id: Id<"articles">, isPublished: boolean) => {
    if (isPublished) {
      await unpublishArticle({ id });
    } else {
      await publishArticle({ id });
    }
  };

  const getCollectionName = (collectionId?: Id<"collections">) => {
    if (!collectionId || !collections) return "Uncategorized";
    const collection = collections.find(
      (c: NonNullable<typeof collections>[number]) => c._id === collectionId
    );
    return collection?.name || "Uncategorized";
  };

  const filteredArticles = articles?.filter((article: NonNullable<typeof articles>[number]) =>
    article.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
      </div>

      {filteredArticles?.length === 0 ? (
        <div className="text-center py-12 border rounded-lg bg-white">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium mb-2">No articles yet</h3>
          <p className="text-gray-500 mb-4">Create your first article to help your customers</p>
          <Button onClick={handleCreateArticle}>
            <Plus className="h-4 w-4 mr-2" />
            Create Article
          </Button>
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
              {filteredArticles?.map((article: NonNullable<typeof articles>[number]) => (
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
                    {getCollectionName(article.collectionId)}
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
                        onClick={() => handleDelete(article._id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
