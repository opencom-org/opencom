"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@opencom/convex";
import { useAuthOptional } from "@/contexts/AuthContext";
import { Input } from "@opencom/ui";
import { Search, FileText, FolderOpen } from "lucide-react";
import Link from "next/link";

export default function HelpCenterPage() {
  const auth = useAuthOptional();
  const workspaceContext = useQuery(api.workspaces.getPublicWorkspaceContext, {});
  const [searchQuery, setSearchQuery] = useState("");
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const workspaceId = auth?.activeWorkspace?._id ?? workspaceContext?._id;
  const isRestricted =
    !isAuthenticated && workspaceContext?.helpCenterAccessPolicy === "restricted";

  const collections = useQuery(
    api.collections.listHierarchy,
    workspaceId ? { workspaceId } : "skip"
  );

  const searchResults = useQuery(
    api.articles.search,
    workspaceId && searchQuery.length >= 2
      ? { workspaceId, query: searchQuery, publishedOnly: true }
      : "skip"
  );

  const publishedArticles = useQuery(
    api.articles.list,
    workspaceId ? { workspaceId, status: "published" } : "skip"
  );

  const collectionsWithArticles = collections?.filter(
    (c: NonNullable<typeof collections>[number]) => c.publishedArticleCount > 0
  );

  if (!workspaceId && workspaceContext !== undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-6">
          <h1 className="text-2xl font-bold mb-2">Help Center unavailable</h1>
          <p className="text-gray-500 mb-4">
            Select a backend connection before browsing help articles.
          </p>
          <Link href="/login" className="text-primary hover:underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  if (isRestricted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-6 max-w-md">
          <h1 className="text-2xl font-bold mb-2">Help Center is private</h1>
          <p className="text-gray-500 mb-4">
            This workspace restricts public Help Center access. Sign in to continue.
          </p>
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-white">
      <header className="bg-primary text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-4">Help Center</h1>
          <p className="text-primary-foreground/80 mb-8 text-lg">Find answers to your questions</p>
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search for articles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-3 text-lg bg-white text-gray-900"
            />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {searchQuery.length >= 2 ? (
          <div>
            <h2 className="text-xl font-semibold mb-6">
              Search results for &ldquo;{searchQuery}&rdquo;
            </h2>
            {searchResults?.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No articles found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {searchResults?.map((article: NonNullable<typeof searchResults>[number]) => (
                  <Link
                    key={article._id}
                    href={`/help/${article.slug}`}
                    className="block bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <h3 className="font-medium text-primary hover:underline">{article.title}</h3>
                    <p className="text-gray-500 text-sm mt-1 line-clamp-2">
                      {article.content.substring(0, 150)}...
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {collectionsWithArticles && collectionsWithArticles.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {collectionsWithArticles.map(
                  (collection: NonNullable<typeof collectionsWithArticles>[number]) => (
                    <Link
                      key={collection._id}
                      href={`/help?collection=${collection.slug}`}
                      className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-2xl">
                          {collection.icon || "📁"}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{collection.name}</h3>
                          <p className="text-sm text-gray-500">
                            {collection.publishedArticleCount} article
                            {collection.publishedArticleCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      {collection.description && (
                        <p className="text-gray-600 text-sm">{collection.description}</p>
                      )}
                    </Link>
                  )
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <FolderOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">No articles yet</h3>
                <p className="text-gray-500">Check back soon for helpful articles</p>
              </div>
            )}

            {publishedArticles && publishedArticles.length > 0 && (
              <div className="mt-12">
                <h2 className="text-xl font-semibold mb-6">All Articles</h2>
                <div className="space-y-3">
                  {publishedArticles.map(
                    (article: NonNullable<typeof publishedArticles>[number]) => (
                      <Link
                        key={article._id}
                        href={`/help/${article.slug}`}
                        className="block bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
                      >
                        <h3 className="font-medium text-primary hover:underline">
                          {article.title}
                        </h3>
                      </Link>
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
