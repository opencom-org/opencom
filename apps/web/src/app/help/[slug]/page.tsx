"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuthOptional } from "@/contexts/AuthContext";
import { Button } from "@opencom/ui";
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export default function ArticlePage() {
  const params = useParams();
  const auth = useAuthOptional();
  const workspaceContext = useQuery(api.workspaces.getPublicWorkspaceContext, {});
  const slug = params.slug as string;
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const isAuthenticated = auth?.isAuthenticated ?? false;
  const isLoading = auth?.isLoading ?? false;
  const workspaceId = auth?.activeWorkspace?._id ?? workspaceContext?._id;
  const isRestricted =
    !isAuthenticated && workspaceContext?.helpCenterAccessPolicy === "restricted";
  const shouldFetchArticle = Boolean(workspaceId && !isRestricted);

  const article = useQuery(
    api.articles.get,
    shouldFetchArticle && workspaceId ? { slug, workspaceId } : "skip"
  );

  const collection = useQuery(
    api.collections.get,
    article?.collectionId ? { id: article.collectionId } : "skip"
  );

  const feedbackStats = useQuery(
    api.articles.getFeedbackStats,
    article?._id ? { articleId: article._id } : "skip"
  );

  const submitFeedback = useMutation(api.articles.submitFeedback);

  const handleFeedback = async (helpful: boolean) => {
    if (!article?._id || feedbackSubmitted) return;
    await submitFeedback({ articleId: article._id, helpful });
    setFeedbackSubmitted(true);
  };

  if (
    isLoading ||
    workspaceContext === undefined ||
    (shouldFetchArticle && article === undefined)
  ) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!workspaceId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center px-6 max-w-md">
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

  if (!article || article.status !== "published") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Article not found</h1>
          <p className="text-gray-500 mb-4">This article may have been unpublished or removed.</p>
          <Link href="/help">
            <Button>Back to Help Center</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/help" className="hover:text-primary">
              Help Center
            </Link>
            {collection && (
              <>
                <span>/</span>
                <Link href={`/help?collection=${collection.slug}`} className="hover:text-primary">
                  {collection.name}
                </Link>
              </>
            )}
            <span>/</span>
            <span className="text-gray-900">{article.title}</span>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        <Link href="/help" className="inline-flex items-center text-primary hover:underline mb-6">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Help Center
        </Link>

        <article className="bg-white rounded-lg border p-8">
          <h1 className="text-3xl font-bold mb-6">{article.title}</h1>

          <div className="prose prose-purple max-w-none">
            {article.content.split("\n").map((paragraph: string, index: number) => (
              <p key={index} className="mb-4">
                {paragraph}
              </p>
            ))}
          </div>

          <div className="mt-12 pt-8 border-t">
            <div className="text-center">
              {feedbackSubmitted ? (
                <div className="text-green-600 font-medium">Thank you for your feedback!</div>
              ) : (
                <>
                  <p className="text-gray-600 mb-4">Was this article helpful?</p>
                  <div className="flex justify-center gap-4">
                    <Button
                      variant="outline"
                      onClick={() => handleFeedback(true)}
                      className="flex items-center gap-2"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      Yes
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleFeedback(false)}
                      className="flex items-center gap-2"
                    >
                      <ThumbsDown className="h-4 w-4" />
                      No
                    </Button>
                  </div>
                </>
              )}
              {feedbackStats && feedbackStats.total > 0 && (
                <p className="text-sm text-gray-400 mt-4">
                  {feedbackStats.helpful} of {feedbackStats.total} found this helpful
                </p>
              )}
            </div>
          </div>
        </article>

        <div className="mt-8 bg-primary/5 rounded-lg border border-primary/20 p-6 text-center">
          <MessageCircle className="h-8 w-8 mx-auto text-primary mb-3" />
          <h3 className="font-semibold text-primary mb-2">Still need help?</h3>
          <p className="text-primary/80 mb-4">Our support team is here to assist you</p>
          <Link href="/">
            <Button>Start a Conversation</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
