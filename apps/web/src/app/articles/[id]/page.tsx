"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Input } from "@opencom/ui";
import { ArrowLeft, Save, Eye, EyeOff, Users } from "lucide-react";
import Link from "next/link";
import type { Id } from "@opencom/convex/dataModel";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";
import {
  toInlineAudienceRule,
  toInlineAudienceRuleFromBuilder,
  type InlineAudienceRule,
} from "@/lib/audienceRules";

export default function ArticleEditorPage() {
  const params = useParams();
  const { activeWorkspace } = useAuth();
  const articleId = params.id as Id<"articles">;

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState<Id<"collections"> | undefined>();
  const [audienceRules, setAudienceRules] = useState<InlineAudienceRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const article = useQuery(api.articles.get, { id: articleId });
  const collections = useQuery(
    api.collections.listHierarchy,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const updateArticle = useMutation(api.articles.update);
  const publishArticle = useMutation(api.articles.publish);
  const unpublishArticle = useMutation(api.articles.unpublish);

  useEffect(() => {
    if (article) {
      setTitle(article.title);
      setContent(article.content);
      setSelectedCollectionId(article.collectionId);
      setAudienceRules(toInlineAudienceRule(article.audienceRules));
    }
  }, [article]);

  const handleSave = async () => {
    if (!articleId) return;
    setIsSaving(true);
    const mutationAudienceRules = audienceRules
      ? (audienceRules as Parameters<typeof updateArticle>[0]["audienceRules"])
      : undefined;
    try {
      await updateArticle({
        id: articleId,
        title,
        content,
        collectionId: selectedCollectionId,
        ...(mutationAudienceRules ? { audienceRules: mutationAudienceRules } : {}),
      });
      setHasChanges(false);
    } catch (error) {
      console.error("Failed to save article:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async () => {
    if (!article) return;
    if (article.status === "published") {
      await unpublishArticle({ id: articleId });
    } else {
      await publishArticle({ id: articleId });
    }
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setHasChanges(true);
  };

  const handleContentChange = (value: string) => {
    setContent(value);
    setHasChanges(true);
  };

  const handleCollectionChange = (value: string) => {
    setSelectedCollectionId(value ? (value as Id<"collections">) : undefined);
    setHasChanges(true);
  };

  const handleAudienceRulesChange = (rules: AudienceRule | null) => {
    setAudienceRules(toInlineAudienceRuleFromBuilder(rules));
    setHasChanges(true);
  };

  if (!article) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/articles">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  article.status === "published"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {article.status}
              </span>
              {hasChanges && <span className="text-sm text-orange-600">Unsaved changes</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTogglePublish}>
              {article.status === "published" ? (
                <>
                  <EyeOff className="h-4 w-4 mr-2" />
                  Unpublish
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Publish
                </>
              )}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white rounded-lg border p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
            <Input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Article title"
              className="text-xl font-semibold"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Collection</label>
            <select
              value={selectedCollectionId || ""}
              onChange={(e) => handleCollectionChange(e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Uncategorized</option>
              {collections?.map((collection: NonNullable<typeof collections>[number]) => (
                <option key={collection._id} value={collection._id}>
                  {collection.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
            <textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Write your article content here..."
              className="w-full h-96 px-4 py-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono text-sm"
            />
            <p className="text-xs text-gray-500 mt-2">Supports Markdown formatting</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6 mt-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Audience Targeting</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Control which visitors can see this article based on their attributes and behavior.
          </p>
          <AudienceRuleBuilder
            value={audienceRules}
            onChange={handleAudienceRulesChange}
            workspaceId={activeWorkspace?._id}
            showSegmentSelector={false}
          />
        </div>

        <div className="mt-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
          <h3 className="font-medium text-primary mb-2">Preview URL</h3>
          <p className="text-sm text-primary">
            {article.status === "published" ? (
              <a
                href={`/help/${article.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                /help/{article.slug}
              </a>
            ) : (
              <span className="text-gray-500">Publish the article to get a public URL</span>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
