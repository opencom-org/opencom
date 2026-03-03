"use client";

import { useState, useEffect, useRef } from "react";
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [removingAssetId, setRemovingAssetId] = useState<Id<"articleAssets"> | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);

  const article = useQuery(api.articles.get, { id: articleId });
  const articleAssets = useQuery(
    api.articles.listAssets,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id, articleId } : "skip"
  );
  const collections = useQuery(
    api.collections.listHierarchy,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const updateArticle = useMutation(api.articles.update);
  const publishArticle = useMutation(api.articles.publish);
  const unpublishArticle = useMutation(api.articles.unpublish);
  const generateAssetUploadUrl = useMutation(api.articles.generateAssetUploadUrl);
  const saveAsset = useMutation(api.articles.saveAsset);
  const deleteAsset = useMutation(api.articles.deleteAsset);

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

  const appendAssetReference = (reference: string, altText: string) => {
    const safeAlt = altText.replace(/\.(png|jpe?g|gif|webp|avif)$/i, "").replace(/[-_]+/g, " ");
    const snippet = `\n\n![${safeAlt}](${reference})\n`;
    setContent((current) => `${current}${snippet}`);
    setHasChanges(true);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeWorkspace?._id) {
      return;
    }

    setAssetError(null);
    setIsUploadingImage(true);
    try {
      const uploadUrl = await generateAssetUploadUrl({ workspaceId: activeWorkspace._id });
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error("Image upload failed");
      }

      const uploadPayload = (await uploadResponse.json()) as { storageId?: Id<"_storage"> };
      if (!uploadPayload.storageId) {
        throw new Error("Upload response missing storage id");
      }

      const savedAsset = await saveAsset({
        workspaceId: activeWorkspace._id,
        articleId,
        storageId: uploadPayload.storageId,
        fileName: file.name,
      });
      appendAssetReference(savedAsset.reference, savedAsset.fileName ?? file.name);
    } catch (error) {
      console.error("Failed to upload article image:", error);
      setAssetError(error instanceof Error ? error.message : "Failed to upload image.");
    } finally {
      setIsUploadingImage(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = "";
      }
    }
  };

  const handleDeleteAsset = async (assetId: Id<"articleAssets">) => {
    if (!activeWorkspace?._id) {
      return;
    }
    setAssetError(null);
    setRemovingAssetId(assetId);
    try {
      await deleteAsset({
        workspaceId: activeWorkspace._id,
        assetId,
      });
    } catch (error) {
      console.error("Failed to delete article asset:", error);
      setAssetError(
        error instanceof Error
          ? error.message
          : "Failed to delete image. Remove markdown references first."
      );
    } finally {
      setRemovingAssetId(null);
    }
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
              <option value="">General</option>
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

          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-medium text-gray-900">Images</p>
                <p className="text-xs text-gray-600">
                  Upload an image to insert markdown like{" "}
                  <code className="font-mono">![alt](oc-asset://...)</code>
                </p>
              </div>
              <input
                ref={uploadInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.gif,.webp,.avif,image/png,image/jpeg,image/gif,image/webp,image/avif"
                className="hidden"
                onChange={handleImageUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => uploadInputRef.current?.click()}
                disabled={isUploadingImage}
              >
                {isUploadingImage ? "Uploading..." : "Upload Image"}
              </Button>
            </div>

            {assetError && (
              <div className="text-xs text-red-700 rounded border border-red-200 bg-red-50 px-2 py-1">
                {assetError}
              </div>
            )}

            {(articleAssets?.length ?? 0) > 0 && (
              <div className="space-y-2">
                {articleAssets?.map((asset: NonNullable<typeof articleAssets>[number]) => (
                  <div
                    key={asset._id}
                    className="flex items-center justify-between gap-2 rounded border border-gray-200 bg-white px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {asset.fileName}
                      </div>
                      <div className="text-xs text-gray-500 font-mono truncate">
                        {asset.reference}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => appendAssetReference(asset.reference, asset.fileName)}
                      >
                        Insert
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteAsset(asset._id)}
                        disabled={removingAssetId === asset._id}
                        className="text-red-700 border-red-200 hover:text-red-800"
                      >
                        {removingAssetId === asset._id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
