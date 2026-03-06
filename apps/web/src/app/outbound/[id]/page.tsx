"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@opencom/convex";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { Button, Input } from "@opencom/ui";
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  Eye,
  MessageSquare,
  Bell,
  Flag,
  MousePointerClick,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Id } from "@opencom/convex/dataModel";
import { AudienceRuleBuilder, type AudienceRule } from "@/components/AudienceRuleBuilder";
import {
  toInlineAudienceRule,
  toInlineAudienceRuleFromBuilder,
  type InlineAudienceRule,
} from "@/lib/audienceRules";
import type { MessageFrequency, MessageTrigger } from "@opencom/types";
import {
  createDefaultClickActionFormState,
  createDefaultPostButtonFormState,
  MessageContent,
  MessageType,
  PostPrimaryActionType,
  toClickActionFormState,
  toMessageClickAction,
  toPostButtonFormState,
  toPostButtons,
  type ClickActionFormState,
  type MessageButton,
  type MessageClickActionType,
  type PostButtonFormState,
} from "./editorState";

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  );
}

function MessageBuilderContent() {
  const params = useParams();
  const messageId = params.id as Id<"outboundMessages">;
  const { activeWorkspace } = useAuth();

  // @ts-ignore Convex generated type graph can exceed TS instantiation depth in app package checks.
  const message = useQuery(api.outboundMessages.get, { id: messageId });
  // @ts-ignore Convex generated type graph can exceed TS instantiation depth in app package checks.
  const stats = useQuery(api.outboundMessages.getStats, { id: messageId });
  const members = useQuery(
    api.workspaceMembers.listByWorkspace,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const eventNames = useQuery(
    api.events.getDistinctNames,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  // @ts-ignore Convex generated type graph can exceed TS instantiation depth in app package checks.
  const updateMessage = useMutation(api.outboundMessages.update);
  // @ts-ignore Convex generated type graph can exceed TS instantiation depth in app package checks.
  const activateMessage = useMutation(api.outboundMessages.activate);
  // @ts-ignore Convex generated type graph can exceed TS instantiation depth in app package checks.
  const pauseMessage = useMutation(api.outboundMessages.pause);

  const [name, setName] = useState("");
  const [content, setContent] = useState<MessageContent>({});
  const [triggers, setTriggers] = useState<MessageTrigger>({ type: "immediate" });
  const [frequency, setFrequency] = useState<MessageFrequency>("once");
  const [showPreview, setShowPreview] = useState(false);
  const [audienceRules, setAudienceRules] = useState<InlineAudienceRule | null>(null);
  const [clickActionForm, setClickActionForm] = useState<ClickActionFormState>(
    createDefaultClickActionFormState()
  );
  const [postButtonForm, setPostButtonForm] = useState<PostButtonFormState>(
    createDefaultPostButtonFormState()
  );

  const articles = useQuery(
    api.articles.list,
    activeWorkspace?._id
      ? { workspaceId: activeWorkspace._id, status: "published" as const }
      : "skip"
  );

  useEffect(() => {
    if (message) {
      setName(message.name);
      setContent(message.content);
      setTriggers(message.triggers || { type: "immediate" });
      setFrequency(message.frequency || "once");
      setAudienceRules(toInlineAudienceRule(message.audienceRules ?? message.targeting));
      setClickActionForm(
        toClickActionFormState(message.content.clickAction as MessageContent["clickAction"])
      );

      if (message.type === "post") {
        setPostButtonForm(toPostButtonFormState((message.content.buttons ?? []) as MessageButton[]));
      } else {
        setPostButtonForm(createDefaultPostButtonFormState());
      }
    }
  }, [message]);

  const handleSave = async () => {
    if (!message) {
      return;
    }

    const clickAction = toMessageClickAction(clickActionForm);

    const nextContent: MessageContent = {
      ...content,
      clickAction,
    };

    if (message.type === "post") {
      nextContent.buttons = toPostButtons(postButtonForm);
    }

    await updateMessage({
      id: messageId,
      name,
      content: nextContent,
      triggers,
      frequency,
      targeting: audienceRules ?? undefined,
    });
  };

  const handleToggleStatus = async () => {
    if (message?.status === "active") {
      await pauseMessage({ id: messageId });
    } else {
      await activateMessage({ id: messageId });
    }
  };

  if (!message) {
    return <div className="p-8">Loading...</div>;
  }

  const renderContentEditor = () => {
    switch (message.type) {
      case "chat":
        return (
          <div className="space-y-4">
            <div>
              <Label>Message Text</Label>
              <textarea
                value={content.text || ""}
                onChange={(e) => setContent({ ...content, text: e.target.value })}
                className="w-full mt-1 p-3 border rounded-md min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter your chat message..."
              />
            </div>
            <div>
              <Label>Sender</Label>
              <select
                value={content.senderId || ""}
                onChange={(e) =>
                  setContent({ ...content, senderId: (e.target.value as Id<"users">) || undefined })
                }
                className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Bot (default)</option>
                {members?.map((member: NonNullable<typeof members>[number]) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name || member.email}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case "post":
        return (
          <div className="space-y-4">
            <div>
              <Label>Title</Label>
              <Input
                value={content.title || ""}
                onChange={(e) => setContent({ ...content, title: e.target.value })}
                placeholder="Announcement title"
              />
            </div>
            <div>
              <Label>Body</Label>
              <textarea
                value={content.body || ""}
                onChange={(e) => setContent({ ...content, body: e.target.value })}
                className="w-full mt-1 p-3 border rounded-md min-h-[150px] focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Enter your announcement content..."
              />
            </div>
            <div>
              <Label>Image URL (optional)</Label>
              <Input
                value={content.imageUrl || ""}
                onChange={(e) => setContent({ ...content, imageUrl: e.target.value })}
                placeholder="https://example.com/image.png"
              />
            </div>

            <div>
              <Label>Video URL (optional)</Label>
              <Input
                value={content.videoUrl || ""}
                onChange={(e) => setContent({ ...content, videoUrl: e.target.value })}
                placeholder="https://example.com/video.mp4"
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-900">Post Buttons</h3>

              <div>
                <Label>Primary CTA Label</Label>
                <Input
                  value={postButtonForm.primaryButtonText}
                  onChange={(e) =>
                    setPostButtonForm((prev) => ({ ...prev, primaryButtonText: e.target.value }))
                  }
                  placeholder="Learn More"
                />
              </div>

              <div>
                <Label>Primary CTA Action</Label>
                <select
                  value={postButtonForm.primaryActionType}
                  onChange={(e) =>
                    setPostButtonForm((prev) => ({
                      ...prev,
                      primaryActionType: e.target.value as PostPrimaryActionType,
                    }))
                  }
                  className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="open_new_conversation">Start New Conversation</option>
                  <option value="open_widget_tab">Open Widget Tab</option>
                  <option value="open_help_article">Open Help Article</option>
                  <option value="url">Open URL</option>
                </select>
              </div>

              {postButtonForm.primaryActionType === "open_new_conversation" && (
                <div>
                  <Label>Prefill Message (optional)</Label>
                  <Input
                    value={postButtonForm.primaryActionPrefillMessage}
                    onChange={(e) =>
                      setPostButtonForm((prev) => ({
                        ...prev,
                        primaryActionPrefillMessage: e.target.value,
                      }))
                    }
                    placeholder="I'd like to learn more about..."
                  />
                </div>
              )}

              {postButtonForm.primaryActionType === "open_widget_tab" && (
                <div>
                  <Label>Widget Tab</Label>
                  <select
                    value={postButtonForm.primaryActionTabId}
                    onChange={(e) =>
                      setPostButtonForm((prev) => ({ ...prev, primaryActionTabId: e.target.value }))
                    }
                    className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="home">Home</option>
                    <option value="messages">Messages</option>
                    <option value="help">Help Center</option>
                    <option value="tickets">Tickets</option>
                  </select>
                </div>
              )}

              {postButtonForm.primaryActionType === "open_help_article" && (
                <div>
                  <Label>Help Article</Label>
                  <select
                    value={postButtonForm.primaryActionArticleId}
                    onChange={(e) =>
                      setPostButtonForm((prev) => ({
                        ...prev,
                        primaryActionArticleId: e.target.value,
                      }))
                    }
                    className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select an article...</option>
                    {articles?.map((article: NonNullable<typeof articles>[number]) => (
                      <option key={article._id} value={article._id}>
                        {article.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {postButtonForm.primaryActionType === "url" && (
                <div>
                  <Label>Destination URL</Label>
                  <Input
                    value={postButtonForm.primaryActionUrl}
                    onChange={(e) =>
                      setPostButtonForm((prev) => ({ ...prev, primaryActionUrl: e.target.value }))
                    }
                    placeholder="https://example.com/pricing"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  id="post-dismiss-enabled"
                  type="checkbox"
                  checked={postButtonForm.dismissEnabled}
                  onChange={(e) =>
                    setPostButtonForm((prev) => ({ ...prev, dismissEnabled: e.target.checked }))
                  }
                  className="rounded"
                />
                <Label htmlFor="post-dismiss-enabled">Show dismiss button</Label>
              </div>

              {postButtonForm.dismissEnabled && (
                <div>
                  <Label>Dismiss Label</Label>
                  <Input
                    value={postButtonForm.dismissButtonText}
                    onChange={(e) =>
                      setPostButtonForm((prev) => ({ ...prev, dismissButtonText: e.target.value }))
                    }
                    placeholder="Dismiss"
                  />
                </div>
              )}
            </div>
          </div>
        );

      case "banner":
        return (
          <div className="space-y-4">
            <div>
              <Label>Banner Text</Label>
              <Input
                value={content.text || ""}
                onChange={(e) => setContent({ ...content, text: e.target.value })}
                placeholder="Enter banner text..."
              />
            </div>
            <div>
              <Label>Style</Label>
              <select
                value={content.style || "inline"}
                onChange={(e) =>
                  setContent({ ...content, style: e.target.value as "inline" | "floating" })
                }
                className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="inline">Inline (pushes content down)</option>
                <option value="floating">Floating (overlays content)</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="dismissible"
                checked={content.dismissible !== false}
                onChange={(e) => setContent({ ...content, dismissible: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="dismissible">Allow users to dismiss</Label>
            </div>
          </div>
        );
    }
  };

  const renderPreview = () => {
    switch (message.type) {
      case "chat":
        return (
          <div className="bg-white rounded-lg shadow-lg p-4 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/50 flex items-center justify-center text-white text-sm">
                {content.senderId ? "A" : "B"}
              </div>
              <div className="flex-1">
                <div className="bg-gray-100 rounded-lg p-3">
                  <p className="text-sm">{content.text || "Your message here..."}</p>
                </div>
              </div>
            </div>
          </div>
        );

      case "post": {
        const postPreviewButtons = [
          ...(postButtonForm.primaryButtonText.trim()
            ? [{ text: postButtonForm.primaryButtonText.trim(), variant: "primary" as const }]
            : []),
          ...(postButtonForm.dismissEnabled && postButtonForm.dismissButtonText.trim()
            ? [{ text: postButtonForm.dismissButtonText.trim(), variant: "secondary" as const }]
            : []),
        ];

        return (
          <div className="bg-white rounded-lg shadow-lg max-w-md overflow-hidden">
            {content.imageUrl && (
              <img src={content.imageUrl} alt="" className="w-full h-40 object-cover" />
            )}
            {content.videoUrl && (
              <video src={content.videoUrl} controls className="w-full max-h-64 bg-black" />
            )}
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2">{content.title || "Title"}</h3>
              <p className="text-gray-600">{content.body || "Your announcement content..."}</p>
              {postPreviewButtons.length > 0 && (
                <div className="mt-4 flex gap-2">
                  {postPreviewButtons.map((button, index) =>
                    button.variant === "secondary" ? (
                      <Button key={`${button.text}-${index}`} size="sm" variant="outline">
                        {button.text}
                      </Button>
                    ) : (
                      <Button key={`${button.text}-${index}`} size="sm">
                        {button.text}
                      </Button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        );
      }

      case "banner":
        return (
          <div
            className={`${content.style === "floating" ? "shadow-lg" : ""} bg-primary text-white p-3 flex items-center justify-between`}
          >
            <p className="text-sm font-medium">{content.text || "Your banner text..."}</p>
            {content.dismissible !== false && (
              <button className="text-white/80 hover:text-white">×</button>
            )}
          </div>
        );
    }
  };

  const getTypeIcon = (type: MessageType) => {
    switch (type) {
      case "chat":
        return <MessageSquare className="h-5 w-5" />;
      case "post":
        return <Bell className="h-5 w-5" />;
      case "banner":
        return <Flag className="h-5 w-5" />;
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link href="/outbound">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            {getTypeIcon(message.type)}
            <h1 className="text-2xl font-bold capitalize">{message.type} Message</h1>
          </div>
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${
              message.status === "active"
                ? "bg-green-100 text-green-800"
                : message.status === "paused"
                  ? "bg-yellow-100 text-yellow-800"
                  : "bg-gray-100 text-gray-800"
            }`}
          >
            {message.status}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="h-4 w-4 mr-2" />
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>
          <Button variant="outline" onClick={handleToggleStatus}>
            {message.status === "active" ? (
              <>
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Activate
              </>
            )}
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Basic Info</h2>
            <div>
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Message name (internal)"
              />
            </div>
          </div>

          {/* Content */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Content</h2>
            {renderContentEditor()}
          </div>

          {/* Triggers */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Trigger</h2>
            <div className="space-y-4">
              <div>
                <Label>Show message when</Label>
                <select
                  value={triggers.type}
                  onChange={(e) =>
                    setTriggers({ ...triggers, type: e.target.value as typeof triggers.type })
                  }
                  className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="immediate">Immediately on page load</option>
                  <option value="page_visit">On specific page visit</option>
                  <option value="time_on_page">After time on page</option>
                  <option value="scroll_depth">After scroll depth</option>
                  <option value="event">After event</option>
                </select>
              </div>

              {triggers.type === "page_visit" && (
                <div className="space-y-2">
                  <Label>Page URL</Label>
                  <Input
                    value={triggers.pageUrl || ""}
                    onChange={(e) => setTriggers({ ...triggers, pageUrl: e.target.value })}
                    placeholder="/pricing or https://example.com/pricing"
                  />
                  <select
                    value={triggers.pageUrlMatch || "contains"}
                    onChange={(e) =>
                      setTriggers({
                        ...triggers,
                        pageUrlMatch: e.target.value as typeof triggers.pageUrlMatch,
                      })
                    }
                    className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="exact">Exact match</option>
                    <option value="contains">Contains</option>
                    <option value="regex">Regex</option>
                  </select>
                </div>
              )}

              {triggers.type === "time_on_page" && (
                <div>
                  <Label>Delay (seconds)</Label>
                  <Input
                    type="number"
                    value={triggers.delaySeconds || 5}
                    onChange={(e) =>
                      setTriggers({ ...triggers, delaySeconds: parseInt(e.target.value) })
                    }
                    min={1}
                  />
                </div>
              )}

              {triggers.type === "scroll_depth" && (
                <div>
                  <Label>Scroll percentage</Label>
                  <Input
                    type="number"
                    value={triggers.scrollPercent || 50}
                    onChange={(e) =>
                      setTriggers({ ...triggers, scrollPercent: parseInt(e.target.value) })
                    }
                    min={1}
                    max={100}
                  />
                </div>
              )}

              {triggers.type === "event" && (
                <div>
                  <Label>Event name</Label>
                  <Input
                    value={triggers.eventName || ""}
                    onChange={(e) => setTriggers({ ...triggers, eventName: e.target.value })}
                    placeholder="button_clicked"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Frequency */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Frequency</h2>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as typeof frequency)}
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="once">Once per user</option>
              <option value="once_per_session">Once per session</option>
              <option value="always">Every time conditions are met</option>
            </select>
          </div>

          {/* Click Action */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <MousePointerClick className="h-5 w-5" />
              Click Action
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Choose what happens when a visitor clicks the message body.
            </p>
            <div className="space-y-4">
              <div>
                <Label>Action Type</Label>
                <select
                  value={clickActionForm.type}
                  onChange={(e) =>
                    setClickActionForm((prev) => ({
                      ...prev,
                      type: e.target.value as MessageClickActionType,
                    }))
                  }
                  className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="open_messenger">Open Messenger</option>
                  <option value="open_new_conversation">Start New Conversation</option>
                  <option value="open_widget_tab">Open Widget Tab</option>
                  <option value="open_help_article">Open Help Article</option>
                  <option value="open_url">Open URL</option>
                  <option value="dismiss">Dismiss Message</option>
                </select>
              </div>

              {clickActionForm.type === "open_new_conversation" && (
                <div>
                  <Label>Prefill Message (optional)</Label>
                  <Input
                    value={clickActionForm.prefillMessage}
                    onChange={(e) =>
                      setClickActionForm((prev) => ({
                        ...prev,
                        prefillMessage: e.target.value,
                      }))
                    }
                    placeholder="I'd like to learn more about..."
                  />
                </div>
              )}

              {clickActionForm.type === "open_widget_tab" && (
                <div>
                  <Label>Tab</Label>
                  <select
                    value={clickActionForm.tabId}
                    onChange={(e) =>
                      setClickActionForm((prev) => ({ ...prev, tabId: e.target.value }))
                    }
                    className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select a tab...</option>
                    <option value="home">Home</option>
                    <option value="messages">Messages</option>
                    <option value="help">Help Center</option>
                    <option value="tickets">Tickets</option>
                  </select>
                </div>
              )}

              {clickActionForm.type === "open_help_article" && (
                <div>
                  <Label>Article</Label>
                  <select
                    value={clickActionForm.articleId}
                    onChange={(e) =>
                      setClickActionForm((prev) => ({ ...prev, articleId: e.target.value }))
                    }
                    className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Select an article...</option>
                    {articles?.map((article: NonNullable<typeof articles>[number]) => (
                      <option key={article._id} value={article._id}>
                        {article.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {clickActionForm.type === "open_url" && (
                <div>
                  <Label>URL</Label>
                  <Input
                    value={clickActionForm.url}
                    onChange={(e) =>
                      setClickActionForm((prev) => ({ ...prev, url: e.target.value }))
                    }
                    placeholder="https://example.com/pricing"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Audience Targeting */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Audience Targeting</h2>
            <p className="text-sm text-gray-500 mb-4">
              Target specific users based on their properties, custom attributes, or behavior.
            </p>
            <AudienceRuleBuilder
              value={audienceRules}
              onChange={(rules: AudienceRule | null) =>
                setAudienceRules(toInlineAudienceRuleFromBuilder(rules))
              }
              eventNames={eventNames ?? []}
              workspaceId={activeWorkspace?._id}
              showSegmentSelector={false}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Preview */}
          {showPreview && (
            <div className="bg-gray-100 border rounded-lg p-6">
              <h2 className="text-lg font-semibold mb-4">Preview</h2>
              <div className="flex justify-center">{renderPreview()}</div>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500 border-t pt-3">
                <MousePointerClick className="h-3.5 w-3.5" />
                <span>
                  Click action:{" "}
                  <span className="font-medium text-gray-700">
                    {clickActionForm.type === "open_messenger"
                      ? "Open Messenger"
                      : clickActionForm.type === "open_new_conversation"
                        ? "Start Conversation"
                        : clickActionForm.type === "open_widget_tab"
                          ? `Open Tab (${clickActionForm.tabId || "—"})`
                          : clickActionForm.type === "open_help_article"
                            ? "Open Article"
                            : clickActionForm.type === "open_url"
                              ? `Open URL`
                              : clickActionForm.type === "dismiss"
                                ? "Dismiss"
                                : "Open Messenger"}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Stats */}
          <div className="bg-white border rounded-lg p-6">
            <h2 className="text-lg font-semibold mb-4">Statistics</h2>
            {stats ? (
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Shown</span>
                  <span className="font-medium">{stats.shown}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Clicked</span>
                  <span className="font-medium">{stats.clicked}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Dismissed</span>
                  <span className="font-medium">{stats.dismissed}</span>
                </div>
                <hr />
                <div className="flex justify-between">
                  <span className="text-gray-600">Click Rate</span>
                  <span className="font-medium">{stats.clickRate.toFixed(1)}%</span>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No data yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MessageBuilderPage() {
  return (
    <AppLayout>
      <MessageBuilderContent />
    </AppLayout>
  );
}
