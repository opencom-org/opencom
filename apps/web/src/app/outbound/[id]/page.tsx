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

type MessageType = "chat" | "post" | "banner";

type MessageClickActionType =
  | "open_messenger"
  | "open_new_conversation"
  | "open_widget_tab"
  | "open_help_article"
  | "open_url"
  | "dismiss";

type MessageButtonActionType =
  | "url"
  | "dismiss"
  | "tour"
  | "open_new_conversation"
  | "open_help_article"
  | "open_widget_tab";

type PostPrimaryActionType =
  | "url"
  | "open_new_conversation"
  | "open_help_article"
  | "open_widget_tab";

type MessageClickAction = {
  type: MessageClickActionType;
  tabId?: string;
  articleId?: Id<"articles">;
  url?: string;
  prefillMessage?: string;
};

type MessageButton = {
  text: string;
  action: MessageButtonActionType;
  url?: string;
  tourId?: Id<"tours">;
  articleId?: Id<"articles">;
  tabId?: string;
  prefillMessage?: string;
};

type MessageContent = {
  text?: string;
  senderId?: Id<"users">;
  title?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  style?: "inline" | "floating";
  dismissible?: boolean;
  clickAction?: MessageClickAction;
  buttons?: MessageButton[];
};

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

  const message = useQuery(api.outboundMessages.get, { id: messageId });
  const stats = useQuery(api.outboundMessages.getStats, { id: messageId });
  const members = useQuery(
    api.workspaceMembers.listByWorkspace,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );
  const eventNames = useQuery(
    api.events.getDistinctNames,
    activeWorkspace?._id ? { workspaceId: activeWorkspace._id } : "skip"
  );

  const updateMessage = useMutation(api.outboundMessages.update);
  const activateMessage = useMutation(api.outboundMessages.activate);
  const pauseMessage = useMutation(api.outboundMessages.pause);

  const [name, setName] = useState("");
  const [content, setContent] = useState<MessageContent>({});
  const [triggers, setTriggers] = useState<{
    type: "immediate" | "page_visit" | "time_on_page" | "scroll_depth" | "event";
    pageUrl?: string;
    pageUrlMatch?: "exact" | "contains" | "regex";
    delaySeconds?: number;
    scrollPercent?: number;
    eventName?: string;
  }>({ type: "immediate" });
  const [frequency, setFrequency] = useState<"once" | "once_per_session" | "always">("once");
  const [showPreview, setShowPreview] = useState(false);
  const [audienceRules, setAudienceRules] = useState<AudienceRule | null>(null);
  const [clickActionType, setClickActionType] = useState<string>("open_messenger");
  const [clickActionTabId, setClickActionTabId] = useState<string>("");
  const [clickActionArticleId, setClickActionArticleId] = useState<string>("");
  const [clickActionUrl, setClickActionUrl] = useState<string>("");
  const [clickActionPrefillMessage, setClickActionPrefillMessage] = useState<string>("");

  const [postPrimaryButtonText, setPostPrimaryButtonText] = useState<string>("Learn More");
  const [postPrimaryActionType, setPostPrimaryActionType] =
    useState<PostPrimaryActionType>("open_new_conversation");
  const [postPrimaryActionUrl, setPostPrimaryActionUrl] = useState<string>("");
  const [postPrimaryActionTabId, setPostPrimaryActionTabId] = useState<string>("messages");
  const [postPrimaryActionArticleId, setPostPrimaryActionArticleId] = useState<string>("");
  const [postPrimaryActionPrefillMessage, setPostPrimaryActionPrefillMessage] =
    useState<string>("");
  const [postDismissEnabled, setPostDismissEnabled] = useState<boolean>(true);
  const [postDismissButtonText, setPostDismissButtonText] = useState<string>("Dismiss");

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
      setAudienceRules((message.audienceRules ?? message.targeting) as AudienceRule | null);
      const ca = message.content.clickAction;
      if (ca) {
        setClickActionType(ca.type);
        setClickActionTabId(ca.tabId || "");
        setClickActionArticleId((ca.articleId as string) || "");
        setClickActionUrl(ca.url || "");
        setClickActionPrefillMessage(ca.prefillMessage || "");
      } else {
        setClickActionType("open_messenger");
        setClickActionTabId("");
        setClickActionArticleId("");
        setClickActionUrl("");
        setClickActionPrefillMessage("");
      }

      if (message.type === "post") {
        const buttons = (message.content.buttons ?? []) as MessageButton[];
        const hasExistingPostButtons = buttons.length > 0;
        const primaryButton = buttons.find((button) => button.action !== "dismiss");
        const dismissButton = buttons.find((button) => button.action === "dismiss");

        if (primaryButton) {
          const parsedPrimaryAction: PostPrimaryActionType =
            primaryButton.action === "url" ||
            primaryButton.action === "open_new_conversation" ||
            primaryButton.action === "open_widget_tab" ||
            primaryButton.action === "open_help_article"
              ? primaryButton.action
              : "open_new_conversation";

          setPostPrimaryButtonText(primaryButton.text || "Learn More");
          setPostPrimaryActionType(parsedPrimaryAction);
          setPostPrimaryActionUrl(primaryButton.url || "");
          setPostPrimaryActionTabId(primaryButton.tabId || "messages");
          setPostPrimaryActionArticleId((primaryButton.articleId as string) || "");
          setPostPrimaryActionPrefillMessage(primaryButton.prefillMessage || "");
        } else {
          setPostPrimaryButtonText("Learn More");
          setPostPrimaryActionType("open_new_conversation");
          setPostPrimaryActionUrl("");
          setPostPrimaryActionTabId("messages");
          setPostPrimaryActionArticleId("");
          setPostPrimaryActionPrefillMessage("");
        }

        setPostDismissEnabled(dismissButton ? true : !hasExistingPostButtons);
        setPostDismissButtonText(dismissButton?.text || "Dismiss");
      }
    }
  }, [message]);

  const handleSave = async () => {
    const clickAction: MessageClickAction = {
      type: clickActionType as MessageClickActionType,
      ...(clickActionType === "open_widget_tab" && clickActionTabId
        ? { tabId: clickActionTabId }
        : {}),
      ...(clickActionType === "open_help_article" && clickActionArticleId
        ? { articleId: clickActionArticleId as Id<"articles"> }
        : {}),
      ...(clickActionType === "open_url" && clickActionUrl ? { url: clickActionUrl } : {}),
      ...(clickActionType === "open_new_conversation" && clickActionPrefillMessage
        ? { prefillMessage: clickActionPrefillMessage }
        : {}),
    };

    const nextContent: MessageContent = {
      ...content,
      clickAction,
    };

    if (message.type === "post") {
      const postButtons: MessageButton[] = [];

      const trimmedPrimaryText = postPrimaryButtonText.trim();
      if (trimmedPrimaryText) {
        const primaryButton: MessageButton = {
          text: trimmedPrimaryText,
          action: postPrimaryActionType,
          ...(postPrimaryActionType === "url" && postPrimaryActionUrl.trim()
            ? { url: postPrimaryActionUrl.trim() }
            : {}),
          ...(postPrimaryActionType === "open_widget_tab" && postPrimaryActionTabId
            ? { tabId: postPrimaryActionTabId }
            : {}),
          ...(postPrimaryActionType === "open_help_article" && postPrimaryActionArticleId
            ? { articleId: postPrimaryActionArticleId as Id<"articles"> }
            : {}),
          ...(postPrimaryActionType === "open_new_conversation" &&
          postPrimaryActionPrefillMessage.trim()
            ? { prefillMessage: postPrimaryActionPrefillMessage.trim() }
            : {}),
        };

        postButtons.push(primaryButton);
      }

      const trimmedDismissText = postDismissButtonText.trim();
      if (postDismissEnabled && trimmedDismissText) {
        postButtons.push({
          text: trimmedDismissText,
          action: "dismiss",
        });
      }

      nextContent.buttons = postButtons.length > 0 ? postButtons : undefined;
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
                  value={postPrimaryButtonText}
                  onChange={(e) => setPostPrimaryButtonText(e.target.value)}
                  placeholder="Learn More"
                />
              </div>

              <div>
                <Label>Primary CTA Action</Label>
                <select
                  value={postPrimaryActionType}
                  onChange={(e) =>
                    setPostPrimaryActionType(e.target.value as PostPrimaryActionType)
                  }
                  className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="open_new_conversation">Start New Conversation</option>
                  <option value="open_widget_tab">Open Widget Tab</option>
                  <option value="open_help_article">Open Help Article</option>
                  <option value="url">Open URL</option>
                </select>
              </div>

              {postPrimaryActionType === "open_new_conversation" && (
                <div>
                  <Label>Prefill Message (optional)</Label>
                  <Input
                    value={postPrimaryActionPrefillMessage}
                    onChange={(e) => setPostPrimaryActionPrefillMessage(e.target.value)}
                    placeholder="I'd like to learn more about..."
                  />
                </div>
              )}

              {postPrimaryActionType === "open_widget_tab" && (
                <div>
                  <Label>Widget Tab</Label>
                  <select
                    value={postPrimaryActionTabId}
                    onChange={(e) => setPostPrimaryActionTabId(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="home">Home</option>
                    <option value="messages">Messages</option>
                    <option value="help">Help Center</option>
                    <option value="tickets">Tickets</option>
                  </select>
                </div>
              )}

              {postPrimaryActionType === "open_help_article" && (
                <div>
                  <Label>Help Article</Label>
                  <select
                    value={postPrimaryActionArticleId}
                    onChange={(e) => setPostPrimaryActionArticleId(e.target.value)}
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

              {postPrimaryActionType === "url" && (
                <div>
                  <Label>Destination URL</Label>
                  <Input
                    value={postPrimaryActionUrl}
                    onChange={(e) => setPostPrimaryActionUrl(e.target.value)}
                    placeholder="https://example.com/pricing"
                  />
                </div>
              )}

              <div className="flex items-center gap-2">
                <input
                  id="post-dismiss-enabled"
                  type="checkbox"
                  checked={postDismissEnabled}
                  onChange={(e) => setPostDismissEnabled(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="post-dismiss-enabled">Show dismiss button</Label>
              </div>

              {postDismissEnabled && (
                <div>
                  <Label>Dismiss Label</Label>
                  <Input
                    value={postDismissButtonText}
                    onChange={(e) => setPostDismissButtonText(e.target.value)}
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
          ...(postPrimaryButtonText.trim()
            ? [{ text: postPrimaryButtonText.trim(), variant: "primary" as const }]
            : []),
          ...(postDismissEnabled && postDismissButtonText.trim()
            ? [{ text: postDismissButtonText.trim(), variant: "secondary" as const }]
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
                  value={clickActionType}
                  onChange={(e) => setClickActionType(e.target.value)}
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

              {clickActionType === "open_new_conversation" && (
                <div>
                  <Label>Prefill Message (optional)</Label>
                  <Input
                    value={clickActionPrefillMessage}
                    onChange={(e) => setClickActionPrefillMessage(e.target.value)}
                    placeholder="I'd like to learn more about..."
                  />
                </div>
              )}

              {clickActionType === "open_widget_tab" && (
                <div>
                  <Label>Tab</Label>
                  <select
                    value={clickActionTabId}
                    onChange={(e) => setClickActionTabId(e.target.value)}
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

              {clickActionType === "open_help_article" && (
                <div>
                  <Label>Article</Label>
                  <select
                    value={clickActionArticleId}
                    onChange={(e) => setClickActionArticleId(e.target.value)}
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

              {clickActionType === "open_url" && (
                <div>
                  <Label>URL</Label>
                  <Input
                    value={clickActionUrl}
                    onChange={(e) => setClickActionUrl(e.target.value)}
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
              onChange={setAudienceRules}
              eventNames={eventNames ?? []}
              workspaceId={activeWorkspace?._id}
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
                    {clickActionType === "open_messenger"
                      ? "Open Messenger"
                      : clickActionType === "open_new_conversation"
                        ? "Start Conversation"
                        : clickActionType === "open_widget_tab"
                          ? `Open Tab (${clickActionTabId || "—"})`
                          : clickActionType === "open_help_article"
                            ? "Open Article"
                            : clickActionType === "open_url"
                              ? `Open URL`
                              : clickActionType === "dismiss"
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
